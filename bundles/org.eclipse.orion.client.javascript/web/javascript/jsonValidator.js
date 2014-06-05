/*******************************************************************************
 * @license
 * Copyright (c) 2014 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License v1.0
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html).
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*jslint amd:true*/
define([
	"esprima",
	"estraverse",
	"orion/editor/projectionTextModel",
	"orion/editor/textModel"
], function(esprima, estraverse, mProjectionTextModel, mTextModel) {
	var ProjectionTextModel = mProjectionTextModel.ProjectionTextModel,
	    TextModel = mTextModel.TextModel,
	    Syntax = esprima.Syntax,
	    ArrayExpression = Syntax.ArrayExpression,
	    ExpressionStatement = Syntax.ExpressionStatement,
	    Literal = Syntax.Literal,
	    ObjectExpression = Syntax.ObjectExpression,
	    UnaryExpression = Syntax.UnaryExpression;
	var SEV_ERROR = "error",
	    ERR_VALUE_EXPECTED = "Expected one of: {string}, {number}, {object}, {array}, 'null', 'true', 'false'.";

	function baseProblem(start, end, message) {
		return {
			start: start,
			end: end,
			description: message,
			severity: SEV_ERROR
		};
	}

	// Problem extending from element.start to element.end
	function elementProblem(element, message) {
		return {
			start: element.range[0],
			end: element.range[1],
			description: message,
			severity: SEV_ERROR
		};
	}

	function tokenProblem(token, message) {
		return elementProblem(token, message);
	}

	function commentProblem(comment) {
		// Comments are sometimes long so only flag the first character
		return baseProblem(comment.range[0], comment.range[0] + 1, "Comments are not permitted in JSON.");
	}

	/**
	 * Validates JSON using the esprima JS parser.
	 * <p>The strategy is as follows:</p>
	 * <ul>
	 * <li>Parse text using native <tt>JSON.parse()</tt>. If it succeeds, the file is valid. If it fails:</li>
	 * <li>Wrap buffer in <tt>( \n)</tt>. (Resolve JS ambiguity with empty object literal {}.) The \n is a
	 * a guard to prevent a possible line comment at EOF from consuming our closing paren.</li>
	 * <li>Sanitize code points (U+2028, U+2028) which JSON permits, but are illegal JS.</li>
	 * <li>Parse the resulting text as JS using Esprima.</li>
	 * <li>Verify that the token list contains only valid JSON token combinations.</li>
	 * <li>Verify that the AST contains no comments.</li>
	 * <li>Verify that the AST contains only valid JSON nodes.</li>
	 * </ul>
	 *
	 * A {@link orion.editor.ProjectionTextModel} is used to track changes applied to the JSON text.
	 */
	function JsonValidator(esprima) {
		if (!esprima)
			throw new Error("Missing parser");
		this.esprima = esprima;
		this.baseModel = this.projModel = null;
	}
	JsonValidator.prototype = {
		initModel: function(jsText) {
			this.destroyModel();
			this.baseModel = new TextModel(jsText);
			this.projModel = new ProjectionTextModel(this.baseModel);
		},
		destroyModel: function() {
			if (this.baseModel) {
				this.projModel.destroy();
				this.baseModel.destroy();
				this.baseModel = this.projModel = null;
			}
		},
		/**
		 * Adds projections that transform the JSON baseModel into a JS projModel.
		 */
		addProjections: function() {
			var proj = this.projModel, text = this.baseModel.getText();
			// Enclose in ( \n)
			proj.addProjection({ text: "\n)", start: text.length, end: text.length });
			proj.addProjection({ text: "(", start: 0, end: 0 });
			// Fix illegal unicode characters
			this.addWhitespaceProjections();
		},
		/**
		 * Adds projections that escape U+2028, U+2029. These may appear unescaped in JSON, but not in JS.
		 */
		addWhitespaceProjections: function() {
			var base = this.baseModel, proj;
			var iter = base.find({ regex: true, string: "[\u2028\u2029]" }); //$NON-NLS-0$
			while (iter.hasNext()) {
				var next = iter.next(), ch = base.getText(next.start, next.end);
				var escaped = "\\u" + ch.charCodeAt(0).toString(16); //$NON-NLS-0$
				proj.addProjection({ start: next.start, end: next.end, text: escaped });
			}
		},
		isJSON: function(text) {
			try {
				JSON.parse(text);
				return true;
			} catch (e) {
				return false;
			}
		},
		checkTokens: function(tokens) {
			var probs = [];
			for (var i=0; i < tokens.length; i++) {
				var tok = tokens[i], next;
				if (tok.type !== "Punctuator")
					continue;
				// Here we're concerned with Punctuators: ,() A trailing comma is not permitted in JSON, nor are ()
				var value = tok.value;
				if ((value === "(" && i > 0) || (value === ")" && i < tokens.length - 1)) {
					// Found ( or ) and it's not one of the wrapping parens injected by this validator, so error
					probs.push(tokenProblem(tok, "Syntax error, delete this token."));
				} else if (value === "," && (next = tokens[i + 1])) {
					if (next.value === "]") {
						// `tok` is a trailing comma in array. Expected a value.
						probs.push(tokenProblem(tok, "Remove this comma."));
					} else if (next.value === "}") {
						// `tok` is a trailing comma in object. Expected a string giving the next property's key.
						probs.push(tokenProblem(tok, "Remove this comma."));
					}
				}
			}
			return probs;
		},
		checkComments: function(comments) {
			var probs = [];
			for (var i=0; i < comments.length; i++) {
				var comment = comments[i];
				probs.push(commentProblem(comment));
			}
			return probs;
		},
		checkNodes: function(ast) {
			// visit the nodes
			var visitor = new NodeVisitor();
			estraverse.traverse(ast, visitor);
			return visitor.getProblems();
		},
		checkAST: function(ast) {
			var probs = [];
			probs = probs.concat(this.checkTokens(ast.tokens));
			probs = probs.concat(this.checkComments(ast.comments));
			probs = probs.concat(this.checkNodes(ast));
			return probs;
		},
		/**
		 * Validates the text, returning problems.
		 * @param {String} text Text of the file to be validated.
		 * @returns {Problem[]}
		 */
		getProblems: function(text) {
			if (this.isJSON(text))
				return [];
			// At this point we're dealing with invalid JSON, so try to get some useful problem output
			this.initModel(text);
			this.addProjections();
			var jsonText = this.projModel.getText();

			var problems;
			try {
				var ast = this.esprima.parse(jsonText, {
					attachComments: false,
					comment: true,
					range: true,
					tolerant: false, // TODO should try tolerant
					tokens: true,
				});
				problems = this.checkAST(ast);
			} catch (esprimaError) {
				var start = esprimaError.index;
				problems = [{
					start: start,
					end: (typeof esprimaError.end === "number" ? esprimaError.end : start + 1),
					description: esprimaError.message.replace(/Line \d+: /, ""),
					severity: SEV_ERROR
				}];
			}
			return this.mapOffsets(problems);
		},
		/**
		 * Translates offsets in `problems` back to the baseModel.
		 * @private
		 * @param {Problem[]} problems whose offsets are relative to projection model.
		 */
		mapOffsets: function(problems) {
			var projModel = this.projModel;
			problems.forEach(function(problem) {
				problem.start = projModel.mapOffset(problem.start);
				problem.end = projModel.mapOffset(problem.end);
			});
			return problems;
		},
		/**
		 * orion.edit.validator
		 * @returns {orion.Promise}
		 */
		computeProblems: function(editorContext/*, context*/) {
			return editorContext.getText()
				.then(this.getProblems.bind(this))
				.then(function(problems) {
					return { problems: problems };
				});
		},
	};

	function NodeVisitor() {
		this.probs = [];
		var _self = this;
		this.enter = function(node, parent) {
			_self.enterNode.call(_self, this /*controller*/, node, parent);
		};
	}
	NodeVisitor.prototype.enterNode = function(controller, node/*, parent*/) {
		var type = node.type, i;
		// (a): TODO: we should validate the `type` against a set, and reject if the type is not valid JSON
		// and controller.skip() so we don't bother visiting its subtree

		// For each ExpressionStatement its `expression.type` must be ObjectExpression|ArrayExpression
		if (type === ExpressionStatement) {
			var expr = node.expression;
			if (expr.type !== ObjectExpression && expr.type !== ArrayExpression) {
				this.probs.push(elementProblem(expr, "Expected {object} or {array}."));
				// controller.skip();
			}
		}
		// For each `prop` in ObjectExpression.properties, `prop` is a valid JSON value.
		else if (type === ObjectExpression) {
			var props = node.properties;
			for (i=0; i < props.length; i++) {
				var prop = props[i], key = prop.key, value = prop.value;
				// Check that property key is a double-quoted string
				if (!isJsonString(key))
					this.probs.push(elementProblem(key, "Expected \"" + key.name + "\"."));
				// Check that value is an allowed value
				if (!isJsonValue(value))
					this.probs.push(elementProblem(value, ERR_VALUE_EXPECTED));
			}
		}
		// For each `element` in ArrayExpression.elements, `element` is a valid JSON value.
		else if (type === ArrayExpression) {
			var elements = node.elements;
			for (i=0; i < elements.length; i++) {
				var elem = elements[i];
				if (!isJsonValue(elem))
					this.probs.push(elementProblem(elem, ERR_VALUE_EXPECTED));
			}
		}
	};
	NodeVisitor.prototype.getProblems = function() {
		return this.probs;
	};

	function isJsonString(n) {
		var value = n.value, raw = n.raw;
		return n.type === Literal && typeof value === "string"
			&& raw[0] === '"' && raw[raw.length-1] === '"' // double-quoted
			&& !/\\\r?\n/.test(raw); // no ES5 multiline string literals
	}

	function isJsonNumber(n) {
		var value = n.value, raw = n.raw;
		return n.type === Literal && typeof value === "number"
			&& !/^0x/.test(raw) && !/0[1-7]+/.test(raw); // no hex, octal literals
	}

	// Determines if a Literal node is an acceptable JSON value
	function isLiteralJsonValue(lit) {
		var value = lit.value;
		switch (typeof value) {
			case "string":
				return isJsonString(lit);
			case "number":
				return isJsonNumber(lit);
			case "object":
				return value === null;
			case "function":
				return false;
		}
		// All other kinds of literals are OK
		return true;
	}

	// Determines if `value` is a JSON value
	function isJsonValue(value) {
		var type = value.type;
		switch (type) {
			case ObjectExpression: // fallthrough
			case ArrayExpression:
				return true;
			case Literal:
				return isLiteralJsonValue(value);
			case UnaryExpression:
				// JSON negative numbers are UnaryExpressions in JS
				return value.operator === "-" && isJsonNumber(value.argument);
			default:
				return false;
		}
	}

	return JsonValidator;
});