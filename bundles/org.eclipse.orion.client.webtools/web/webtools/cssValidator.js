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
/*global CSSLint*/
/*eslint-env amd*/
define("webtools/cssValidator", [ //$NON-NLS-0$
	'csslint', //$NON-NLS-0$
	'orion/objects' //$NON-NLS-0$
], function(csslint, Objects) {

	/**
	 * @description Creates a new validator
	 * @constructor
	 * @public
	 * @since 6.0
	 */
	function CssValidator() {
	}
	
	// TODO How to keep this list up to date with rules definitions and settings options
	var config = {
		// Define the default values for the rules
		// 0:off, 1:warning, 2:error
		rules: {
			"duplicate-properties" : 2 //$NON-NLS-0$
		},
		/**
		 * @description Sets the given rule to the given enabled value
		 * @function
		 * @private
		 * @param {String} ruleId The id of the rule to change
		 * @param {Number} value The value to set the rule to
		 * @param {Object} [key] Optional key to use for complex rule configuration.
		 */
		setOption: function(ruleId, value, key) {
			if (typeof value === "number") {
				if(Array.isArray(this.rules[ruleId])) {
					var ruleConfig = this.rules[ruleId];
					if (key) {
						ruleConfig[1] = ruleConfig[1] || {};
						ruleConfig[1][key] = value;
					} else {
						ruleConfig[0] = value;
					}
				}
				else {
					this.rules[ruleId] = value;
				}
			}
		}
	};

	/**
	 * @description Converts the configuration rule for the given csslint problem message 
	 * 				to an Orion problem severity. One of 'warning', 'error'.
	 * @public
	 * @param {Object} prob The problem object
	 * @returns {String} the severity string
	 */
	function getSeverity(message) {
		var val = 2;
		var ruleConfig = config.rules[message.rule.id];
		val = ruleConfig;
		switch (val) {
			case 1: return "warning"; //$NON-NLS-0$
			case 2: return "error"; //$NON-NLS-0$
		}
		return message.type;
	}

	Objects.mixin(CssValidator.prototype, /** @lends webtools.CssValidator.prototype*/ {
		
		/**
		 * @description Callback to create problems from orion.edit.validator
		 * @function
		 * @public
		 * @param {orion.edit.EditorContext} editorContext The editor context
		 * @param {Object} context The in-editor context (selection, offset, etc)
		 * @returns {orion.Promise} A promise to compute some problems
		 */
		computeProblems: function(editorContext, context) {
			var that = this;
			return editorContext.getText().then(function(text) {
				return that._computeProblems(text);
			});
		},
		
		/**
		 * @description Create the problems 
		 * @function
		 * @private
		 * @param {String} contents The file contents
		 * @returns {Array} The problem array
		 */
		_computeProblems: function(contents) {
			var cssResult = csslint.verify(contents),
			    messages = cssResult.messages,
			    problems = [];
			for (var i=0; i < messages.length; i++) {
				var message = messages[i];
				if (message.line) {
					var problem = {
						description: message.message,
						line: message.line,
						start: message.col,
						end: message.col + message.evidence.length,
						severity: getSeverity(message)
					};
					problems.push(problem);
				}
			}
			return {problems: problems};
		},
		
		/**
		 * @description Callback from orion.cm.managedservice
		 * @function
		 * @public
		 * @param {Object} properties The properties that have been changed
		 */
		updated: function(properties) {
			if (!properties) {
				return;
			}
			// TODO these option -> setting mappings are becoming hard to manage
			// And they must be kept in sync with javascriptPlugin.js
			config.setOption("duplicate-properties", properties.validate_duplicate_properties); //$NON-NLS-0$
		}
	});
	
	return {
		CssValidator : CssValidator
	};
});