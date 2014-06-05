/*******************************************************************************
 * @license
 * Copyright (c) 2014 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
/*jslint amd:true mocha:true*/
define([
	"chai/chai",
	"esprima",
	"javascript/jsonValidator",
	"mocha/mocha" // last because Mocha is not a module
], function(chai, esprima, JSONValidator) {
	var assert = chai.assert;

	var validator;
	describe("JSON validator", function() {
		beforeEach(function() {
			validator = new JSONValidator(esprima);
		});
		describe("accepts valid JSON", function() {
			it("minimal", function() {
				assert.deepEqual(validator.getProblems("{}"), []);
				assert.deepEqual(validator.getProblems("[]"), []);
			});
			it("tricky code points", function() {
				assert.deepEqual(validator.getProblems('{"str": "own\u2028ed"}'), []);
				assert.deepEqual(validator.getProblems('{"str": "own\u2029ed"}'), []);
			});
		});
		describe("rejects invalid JSON", function() {
			it("junk", function() {
				assert.operator(validator.getProblems("%&!").length, ">", 0);
			});
		});
		describe("rejects invalid JSON that is valid JS", function() {
			describe("comments", function() {
				it("comments", function() {
					assert.operator(validator.getProblems("{} // whoa").length, ">", 0);
					assert.operator(validator.getProblems("{ /*hi*/ } ").length, ">", 0);
				});
				it("comments - problem flags first char only", function() {
					var probs = validator.getProblems(" {} // whoa");
					assert.operator(probs.length, ">", 0);
					assert.equal(probs[0].start, 4);
					assert.equal(probs[0].end, 5);
	
					probs = validator.getProblems("{ /*hi*/ } ");
					assert.operator(probs.length, ">", 0);
					assert.equal(probs[0].start, 2);
					assert.equal(probs[0].end, 3);
				});
			});
			describe("tokens", function() {
				it("trailing comma", function() {
					var probs = validator.getProblems("[1,]");
					assert.operator(probs.length, ">", 0);
					assert.equal(probs[0].start, 2, "comma is flagged");
					
					probs = validator.getProblems("{\"a\": 0,}");
					assert.operator(probs.length, ">", 0);
					assert.equal(probs[0].start, 7, "comma is flagged");
				});
				it("parens", function() {
					assert.operator(validator.getProblems("({})").length, ">", 0);
					assert.operator(validator.getProblems("([])").length, ">", 0);
				});
			});
			describe("nodes", function() {
				it("minimal", function() {
					assert.operator(validator.getProblems("").length, ">", 0);
					assert.operator(validator.getProblems("x").length, ">", 0);
					assert.operator(validator.getProblems("x;").length, ">", 0);
				});
				it("property keys missing \"double quotes\"", function() {
					assert.operator(validator.getProblems("{ a: 0 }").length, ">", 0);
					assert.operator(validator.getProblems("{ 'a': 0 }").length, ">", 0);
				});
				it("disallowed property values", function() {
					assert.operator(validator.getProblems("{ \"a\": /a+/ }").length, ">", 0);
					assert.operator(validator.getProblems("{ \"a\": function(){} }").length, ">", 0);
					assert.operator(validator.getProblems("{ \"a\": 'single quote' }").length, ">", 0);
					assert.operator(validator.getProblems("{ \"a\": 01234567 }").length, ">", 0, "octal literal");
				});
				it("disallowed array values", function() {
					assert.operator(validator.getProblems("[undefined]").length, ">", 0);
					assert.operator(validator.getProblems("[1, 'a']").length, ">", 0, "single quote");
					assert.operator(validator.getProblems("[0xdeadbeef]").length, ">", 0);
					assert.operator(validator.getProblems("[07654321]").length, ">", 0, "octal literal");
					assert.operator(validator.getProblems('{ "a": [function(){}] }').length, ">", 0);
					assert.operator(validator.getProblems('{ "a": [1, /b+/] }').length, ">", 0);
				});
				it("multiline string literal", function() {
					var probs = validator.getProblems('{ "a": "b\\\nc" }');
					assert.operator(probs.length, ">", 0);
				});
				it("missing comma", function() {
					var text = ['{',
						'"a": "b"' ,
						'"1": "x"' ,
						'}'
					].join("\n");
					var probs = validator.getProblems(text);
					assert.equal(probs.length, 1);
					assert.equal(probs[0].start, 11); // 0th char of "1"
				});
			});
		});
	});
});
