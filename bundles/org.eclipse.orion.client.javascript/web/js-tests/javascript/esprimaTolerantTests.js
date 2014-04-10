/*jslint amd:true*/
/*global esprima:true*/
define([
	"chai/chai",
	"esprima"
], function(chai, _esprima) {
	var assert = chai.assert;
	if (_esprima)
		esprima = _esprima;

	//////////////////////////////////////////////////////////
	// Helpers
	//////////////////////////////////////////////////////////
	function parseFull(contents) {
		// esprima ~1.1.0 always sets 'raw' field on Literal nodes. Esprima ~1.0.0 only does so if
		// 'raw' flag passed. To ensure identical AST shape across versions, set the flag.
		return esprima.parse(contents, {
			range: true,
			tolerant: true,
			comment: true,
			tokens: true,
			raw: true
		});
	}

	function pf(str /*, args*/) {
		var args = Array.prototype.slice.call(arguments, 1);
		var i=0;
		return str.replace(/%s/g, function() {
			return String(args[i++]);
		});
	}

	function runTest(name, data) {
		assert.ok(data.source);
		var ast = parseFull(data.source);

		// Check AST body
		var expectedBody = data.body, actualBody = ast.body && ast.body[0];
		if (expectedBody) {
			// Could use deepEqual here but its debugging output is worse than strings
			assert.equal("*** " + JSON.stringify(actualBody), "*** " + JSON.stringify(expectedBody));
		}

		// Check errors
		var expectedErrors = data.errors, actualErrors = ast.errors;
		if (expectedErrors) {
			expectedErrors = Array.isArray(expectedErrors) ? expectedErrors : [expectedErrors];
			assert.equal(actualErrors.length, expectedErrors.length, "Correct number of errors");
			expectedErrors.forEach(function(expected, i) {
				var actual = actualErrors[i];
				var formatStr = "Error #%s has correct %s";
				if (typeof expected.token === "string")
					assert.equal(actual.token, expected.token, pf(formatStr, i, "token"));
				if (typeof expected.index === "number")
					assert.equal(actual.index, expected.index, pf(formatStr, i, "index"));
				if (typeof expected.lineNumber === "number")
					assert.equal(actual.lineNumber, expected.lineNumber, pf("Error %s has correct %s", i, "lineNumber"));
				assert.equal(actual.message.replace(/^Line [0-9]*: /, ""), expected.message, pf("Error %s has correct %s", i, "message"));
			});
		}

		// TODO extras
	}

	//////////////////////////////////////////////////////////
	// Tests
	//////////////////////////////////////////////////////////
	var tests = {};
	var testData = {
		"recovery basic parse": {
			source: "foo.bar",
			errors: [],
			body: {type:"ExpressionStatement",expression:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"foo",range:[0,3]},property:{type:"Identifier",name:"bar",range:[4,7]},range:[0,7]},range:[0,7]}
		},
		"recovery - dot followed by EOF": {
			source: "foo.",
			errors: [{ index: 4, lineNumber: 1, message: "Unexpected end of input" }],
			body: {type:"ExpressionStatement",expression:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"foo",range:[0,3]},property:null,range:[0,4]},range:[0,4]}
		},
		"Function args 2": {
			source: "var ttt, uuu;\nttt(ttt, /**/)",
			errors: [{ index:27, lineNumber: 2, message: "Unexpected token )", token: ")" }],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"ttt",range:[4,7]},init:null,range:[4,7]},{type:"VariableDeclarator",id:{type:"Identifier",name:"uuu",range:[9,12]},init:null,range:[9,12]}],kind:"var",range:[0,13]}
		},
		"Function args 3": {
			source: "var ttt, uuu;\nttt(ttt, /**/, uuu)",
			errors: [
				{ index: 27, message: "Unexpected token ,",    token: "," },
				{ index: 29, message: "Unexpected identifier", token: "uuu" },
				{ index: 32, message: "Unexpected token )",    token: ")" }
			],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"ttt",range:[4,7]},init:null,range:[4,7]},{type:"VariableDeclarator",id:{type:"Identifier",name:"uuu",range:[9,12]},init:null,range:[9,12]}],kind:"var",range:[0,13]}
		},
		"broken after dot 1": {
			source: "var ttt = { ooo:8};\nttt.",
			errors: [{ index: 24, message: "Unexpected end of input" }],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"ttt",range:[4,7]},init:{type:"ObjectExpression",properties:[{type:"Property",key:{type:"Identifier",name:"ooo",range:[12,15]},value:{type:"Literal",value:8,raw:"8",range:[16,17]},kind:"init",range:[12,17]}],range:[10,18]},range:[4,18]}],kind:"var",range:[0,19]}
		},
		"broken after dot 2": {
			source: "var ttt = { ooo:8};\nif (ttt.) { ttt }",
			errors: [{ index: 28, message: "Unexpected token )", token: ")" }],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"ttt",range:[4,7]},init:{type:"ObjectExpression",properties:[{type:"Property",key:{type:"Identifier",name:"ooo",range:[12,15]},value:{type:"Literal",value:8,raw:"8",range:[16,17]},kind:"init",range:[12,17]}],range:[10,18]},range:[4,18]}],kind:"var",range:[0,19]}
		},
		"broken after dot 3": {
			source: "var ttt = { ooo:this.};",
			errors: [{ index: 21, message: "Unexpected token }", token: "}" }],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"ttt",range:[4,7]},init:{type:"ObjectExpression",properties:[{type:"Property",key:{type:"Identifier",name:"ooo",range:[12,15]},value:{type:"MemberExpression",computed:false,object:{type:"ThisExpression",range:[16,20]},property:null,range:[16,21]},kind:"init",range:[12,21]}],range:[10,22]},range:[4,22]}],kind:"var",range:[0,23]}
		},
		"broken after dot 3a": {
			source: "var ttt = { ooo:this./**/};",
			errors: [{ index: 25, message: "Unexpected token }", token: "}" }],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"ttt",range:[4,7]},init:{type:"ObjectExpression",properties:[{type:"Property",key:{type:"Identifier",name:"ooo",range:[12,15]},value:{type:"MemberExpression",computed:false,object:{type:"ThisExpression",range:[16,20]},property:null,range:[16,21]},kind:"init",range:[12,21]}],range:[10,26]},range:[4,26]}],kind:"var",range:[0,27]}
		},
		"broken after dot 4": {
			source: "var ttt = { ooo:8};\nfunction ff() { \nttt.}",
			errors: [{ index: 41, message: "Unexpected token }", token: "}" }],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"ttt",range:[4,7]},init:{type:"ObjectExpression",properties:[{type:"Property",key:{type:"Identifier",name:"ooo",range:[12,15]},value:{type:"Literal",value:8,raw:"8",range:[16,17]},kind:"init",range:[12,17]}],range:[10,18]},range:[4,18]}],kind:"var",range:[0,19]}
		},
		"broken after dot 4a": {
			source: "var ttt = { ooo:8};\nfunction ff() { \nttt./**/}",
			errors: [{ index: 45, message: "Unexpected token }", token: "}" }],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"ttt",range:[4,7]},init:{type:"ObjectExpression",properties:[{type:"Property",key:{type:"Identifier",name:"ooo",range:[12,15]},value:{type:"Literal",value:8,raw:"8",range:[16,17]},kind:"init",range:[12,17]}],range:[10,18]},range:[4,18]}],kind:"var",range:[0,19]}
		},
		"broken after dot 5": {
			source: "var first = {ooo:9};\nfirst.\nvar jjj;",
			errors: [{ index: 32, message: "Unexpected identifier", token: "jjj" }],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"first",range:[4,9]},init:{type:"ObjectExpression",properties:[{type:"Property",key:{type:"Identifier",name:"ooo",range:[13,16]},value:{type:"Literal",value:9,raw:"9",range:[17,18]},kind:"init",range:[13,18]}],range:[12,19]},range:[4,19]}],kind:"var",range:[0,20]}
		},
		"broken after dot 6": {
			source: "var first = {ooo:9};\nfirst.\nif (x) { }",
			errors: [{ index: 35, message: "Unexpected token {", token: "{" }],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"first",range:[4,9]},init:{type:"ObjectExpression",properties:[{type:"Property",key:{type:"Identifier",name:"ooo",range:[13,16]},value:{type:"Literal",value:9,raw:"9",range:[17,18]},kind:"init",range:[13,18]}],range:[12,19]},range:[4,19]}],kind:"var",range:[0,20]}
		},
		"computed member expressions5": {
			source: "var foo = { at: { bar: 0} };\nfoo[at.foo.bar].",
			errors: [{ lineNumber: 2, message: "Unexpected end of input" }],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"foo",range:[4,7]},init:{type:"ObjectExpression",properties:[{type:"Property",key:{type:"Identifier",name:"at",range:[12,14]},value:{type:"ObjectExpression",properties:[{type:"Property",key:{type:"Identifier",name:"bar",range:[18,21]},value:{type:"Literal",value:0,raw:"0",range:[23,24]},kind:"init",range:[18,24]}],range:[16,25]},kind:"init",range:[12,25]}],range:[10,27]},range:[4,27]}],kind:"var",range:[0,28]}
		},
		"computed member expressions6": {
			source: "var x = 0;\nvar foo = [];\nfoo[x./**/]",
			errors: [{ lineNumber: 3, message: "Unexpected token ]", token: "]" }],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"x",range:[4,5]},init:{type:"Literal",value:0,raw:"0",range:[8,9]},range:[4,9]}],kind:"var",range:[0,10]}
		},
		"full file inferecing 20": {
			source: "x./**/\nvar x = {};\nx.fff = '';",
			errors: [{ lineNumber: 2, message: "Unexpected identifier", token: "x" }],
			body: {type:"ExpressionStatement",expression:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"x",range:[0,1]},property:{type:"Identifier",name:"var",range:[7,10]},range:[0,10]},range:[0,6]}
		},
		"full file inferecing 21": {
			source: "function a() {\nx.fff = '';\n}\nx./**/\nvar x = {}; ",
			errors: [{ lineNumber: 5, message: "Unexpected identifier", token: "x" }],
			body: {type:"FunctionDeclaration",id:{type:"Identifier",name:"a",range:[9,10]},params:[],body:{type:"BlockStatement",body:[{type:"ExpressionStatement",expression:{type:"AssignmentExpression",operator:"=",left:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"x",range:[15,16]},property:{type:"Identifier",name:"fff",range:[17,20]},range:[15,20]},right:{type:"Literal",value:"",raw:"''",range:[23,25]},range:[15,25]},range:[15,26]}],range:[13,28]},range:[0,28]}
		},
		"full file inferecing 22": {
			source: "x./**/\nfunction a() {\nx.fff = '';\n}\nvar x = {}; ",
			errors: [{ lineNumber: 2, message: "Unexpected identifier", token: "a" }],
			body: {type:"ExpressionStatement",expression:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"x",range:[0,1]},property:{type:"Identifier",name:"function",range:[7,15]},range:[0,15]},range:[0,6]}
		},
//		node12: {
//			source: "/*jslint node:true*/\nprocess.",
//			errors: [{ lineNumber: 2, message: "Unexpected identifier" }],
//			body: {type:"ExpressionStatement",expression:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"process",range:[21,28]},property:null,range:[21,29]},range:[21,29]}
//		},
		"tolerant parsing function 1": {
			source: "var xxxyyy = {};\nfunction foo() {\n    if (xx",
			errors: [{ lineNumber: 3, message: "Unexpected end of input" }],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"xxxyyy",range:[4,10]},init:{type:"ObjectExpression",properties:[],range:[13,15]},range:[4,15]}],kind:"var",range:[0,16]}
		},
		"tolerant parsing function 2": {
			source: "function foo() {\n    var xxxyyy = false;\n    if (!xx",
			errors: [{ lineNumber: 3, message: "Unexpected end of input" }],
			body: {type:"FunctionDeclaration",id:{type:"Identifier",name:"foo",range:[9,12]},params:[],body:{type:"BlockStatement",body:[{type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"xxxyyy",range:[25,31]},init:{type:"Literal",value:false,raw:"false",range:[34,39]},range:[25,39]}],kind:"var",range:[21,40]},{type:"IfStatement",test:{type:"UnaryExpression",operator:"!",argument:{type:"Identifier",name:"xx",range:[50,52]},range:[49,52]},consequent:null,alternate:null,range:[45,52]}],range:[15,52]},range:[0,52]}
		},
		"tolerant parsing function 3": {
			source: "function foo(xxxyyy) {\n    if (!xx",
			errors: [{ lineNumber: 2, message: "Unexpected end of input" }],
			body: {type:"FunctionDeclaration",id:{type:"Identifier",name:"foo",range:[9,12]},params:[{type:"Identifier",name:"xxxyyy",range:[13,19]}],body:{type:"BlockStatement",body:[{type:"IfStatement",test:{type:"UnaryExpression",operator:"!",argument:{type:"Identifier",name:"xx",range:[32,34]},range:[31,34]},consequent:null,alternate:null,range:[27,34]}],range:[21,34]},range:[0,34]}
		},
		"tolerant parsing function 4": {
			source: "var x = { bazz: 3 };\nfunction foo() {\n    if (x.b",
			errors: [{ lineNumber: 3, message: "Unexpected end of input" }],
			body: {type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"x",range:[4,5]},init:{type:"ObjectExpression",properties:[{type:"Property",key:{type:"Identifier",name:"bazz",range:[10,14]},value:{type:"Literal",value:3,raw:"3",range:[16,17]},kind:"init",range:[10,17]}],range:[8,19]},range:[4,19]}],kind:"var",range:[0,20]}
		},
		"tolerant parsing function 5": {
			source: "function foo(p) {\n    p.ffffff = false;\n    while (p.ff",
			errors: [{ lineNumber: 3, message: "Unexpected end of input" }],
			body: {type:"FunctionDeclaration",id:{type:"Identifier",name:"foo",range:[9,12]},params:[{type:"Identifier",name:"p",range:[13,14]}],body:{type:"BlockStatement",body:[{type:"ExpressionStatement",expression:{type:"AssignmentExpression",operator:"=",left:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"p",range:[22,23]},property:{type:"Identifier",name:"ffffff",range:[24,30]},range:[22,30]},right:{type:"Literal",value:false,raw:"false",range:[33,38]},range:[22,38]},range:[22,39]},{type:"WhileStatement",test:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"p",range:[51,52]},property:{type:"Identifier",name:"ff",range:[53,55]},range:[51,55]},range:[44,55]}],range:[16,55]},range:[0,55]}
		},
		"tolerant parsing function 6": {
			source: "function foo(p) {\n    p.ffffff = false;\n    if (p) {\n        while (p.ff",
			errors: [{ lineNumber: 4, message: "Unexpected end of input" }],
			body: {type:"FunctionDeclaration",id:{type:"Identifier",name:"foo",range:[9,12]},params:[{type:"Identifier",name:"p",range:[13,14]}],body:{type:"BlockStatement",body:[{type:"ExpressionStatement",expression:{type:"AssignmentExpression",operator:"=",left:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"p",range:[22,23]},property:{type:"Identifier",name:"ffffff",range:[24,30]},range:[22,30]},right:{type:"Literal",value:false,raw:"false",range:[33,38]},range:[22,38]},range:[22,39]},{type:"IfStatement",test:{type:"Identifier",name:"p",range:[48,49]},consequent:{type:"BlockStatement",body:[{type:"WhileStatement",test:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"p",range:[68,69]},property:{type:"Identifier",name:"ff",range:[70,72]},range:[68,72]},range:[61,72]}],range:[51,72]},alternate:null,range:[44,72]}],range:[16,72]},range:[0,72]}
		},
		"tolerant parsing function 7": {
			source: "function foo(p) {\n    p.ffffff = false;\n    if (p) {\n        for (var q in p.ff",
			errors: [{ lineNumber: 4, message: "Unexpected end of input" }],
			body: {type:"FunctionDeclaration",id:{type:"Identifier",name:"foo",range:[9,12]},params:[{type:"Identifier",name:"p",range:[13,14]}],body:{type:"BlockStatement",body:[{type:"ExpressionStatement",expression:{type:"AssignmentExpression",operator:"=",left:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"p",range:[22,23]},property:{type:"Identifier",name:"ffffff",range:[24,30]},range:[22,30]},right:{type:"Literal",value:false,raw:"false",range:[33,38]},range:[22,38]},range:[22,39]},{type:"IfStatement",test:{type:"Identifier",name:"p",range:[48,49]},consequent:{type:"BlockStatement",body:[{type:"ForInStatement",left:{type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"q",range:[70,71]},init:null,range:[70,71]}],kind:"var",range:[66,71]},right:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"p",range:[75,76]},property:{type:"Identifier",name:"ff",range:[77,79]},range:[75,79]},each:false,range:[61,79]}],range:[51,79]},alternate:null,range:[44,79]}],range:[16,79]},range:[0,79]}
		},
		"tolerant parsing function 8": {
			source: "function foo(p) {\n    p.ffffff = false;\n    if (p) {\n        for (var q in p) {\n            while (p.ff",
			errors: [{ lineNumber: 5, message: "Unexpected end of input" }],
			body: {type:"FunctionDeclaration",id:{type:"Identifier",name:"foo",range:[9,12]},params:[{type:"Identifier",name:"p",range:[13,14]}],body:{type:"BlockStatement",body:[{type:"ExpressionStatement",expression:{type:"AssignmentExpression",operator:"=",left:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"p",range:[22,23]},property:{type:"Identifier",name:"ffffff",range:[24,30]},range:[22,30]},right:{type:"Literal",value:false,raw:"false",range:[33,38]},range:[22,38]},range:[22,39]},{type:"IfStatement",test:{type:"Identifier",name:"p",range:[48,49]},consequent:{type:"BlockStatement",body:[{type:"ForInStatement",left:{type:"VariableDeclaration",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",name:"q",range:[70,71]},init:null,range:[70,71]}],kind:"var",range:[66,71]},right:{type:"Identifier",name:"p",range:[75,76]},body:{type:"BlockStatement",body:[{type:"WhileStatement",test:{type:"MemberExpression",computed:false,object:{type:"Identifier",name:"p",range:[99,100]},property:{type:"Identifier",name:"ff",range:[101,103]},range:[99,103]},range:[92,103]}],range:[78,103]},each:false,range:[61,103]}],range:[51,103]},alternate:null,range:[44,103]}],range:[16,103]},range:[0,103]}
		},
		"tolerant parsing function 9": {
			source: "function f(s) {}\nf(JSON.str",
			errors: [{ lineNumber: 2, message: "Unexpected end of input" }],
			body: {type:"FunctionDeclaration",id:{type:"Identifier",name:"f",range:[9,10]},params:[{type:"Identifier",name:"s",range:[11,12]}],body:{type:"BlockStatement",body:[],range:[14,16]},range:[0,16]}
		},
		"tolerant parsing function 10": {
			source: "function f(a,b) {}\nf(0,JSON.str",
			errors: [{ lineNumber: 2, message: "Unexpected end of input" }],
			body: {type:"FunctionDeclaration",id:{type:"Identifier",name:"f",range:[9,10]},params:[{type:"Identifier",name:"a",range:[11,12]},{type:"Identifier",name:"b",range:[13,14]}],body:{type:"BlockStatement",body:[],range:[16,18]},range:[0,18]}
		},
		"cycle 2": {
			source: "function foo() {\nthis._init = function() { return this; }\nthis.cmd = function() {\nthis._in",
			errors: [{ lineNumber: 4, message: "Unexpected end of input" }],
			body: {type:"FunctionDeclaration",id:{type:"Identifier",name:"foo",range:[9,12]},params:[],body:{type:"BlockStatement",body:[{type:"ExpressionStatement",expression:{type:"AssignmentExpression",operator:"=",left:{type:"MemberExpression",computed:false,object:{type:"ThisExpression",range:[17,21]},property:{type:"Identifier",name:"_init",range:[22,27]},range:[17,27]},right:{type:"FunctionExpression",id:null,params:[],body:{type:"BlockStatement",body:[{type:"ReturnStatement",argument:{type:"ThisExpression",range:[50,54]},range:[43,55]}],range:[41,57]},range:[30,57]},range:[17,57]},range:[17,58]},{type:"ExpressionStatement",expression:{type:"AssignmentExpression",operator:"=",left:{type:"MemberExpression",computed:false,object:{type:"ThisExpression",range:[58,62]},property:{type:"Identifier",name:"cmd",range:[63,66]},range:[58,66]},right:{type:"FunctionExpression",id:null,params:[],body:{type:"BlockStatement",body:[{type:"ExpressionStatement",expression:{type:"MemberExpression",computed:false,object:{type:"ThisExpression",range:[82,86]},property:{type:"Identifier",name:"_in",range:[87,90]},range:[82,90]},range:[82,90]}],range:[80,90]},range:[69,90]},range:[58,90]},range:[58,90]}],range:[15,90]},range:[0,90]}
		},
	};
	Object.keys(testData).forEach(function(name) {
		tests["test " + name] = runTest.bind(tests, name, testData[name]);
	});

	return tests;
});
