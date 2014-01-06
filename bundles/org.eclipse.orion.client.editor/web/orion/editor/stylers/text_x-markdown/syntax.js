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

/*jslint amd:true*/
define("orion/editor/stylers/text_x-markdown/syntax", [], function() { //$NON-NLS-0$
	var grammars = [];
	grammars.push({
		id: "orion.markdown",
		contentTypes: ["text/x-markdown"],
		patterns: [
			// Inline HTML
			{
				include: "orion.html"
			},
			// Header (Setext)
			{
				match: "^(={2,}|-{2,})$",
				name: "entity.name.header.setext"
			},
			// Header (Atx)
			// http://daringfireball.net/projects/markdown/syntax#header
			{	match: "^#{1,6}.*$",
				name: "entity.name.header.atx"
			},
			// Paragraphs
			// Blockquotes
			// **** Block Elements ****
			// Lists
			// http://daringfireball.net/projects/markdown/syntax#list
			{	begin: "^( )*([\\*\\+\\-]|(\\d.)) ",
				end: "^$",
				captures: {
					2: {name: "keyword.list"}
				},
				patterns: [
//					{
//						match: "\\[.*\\]",
//						name: "keyword.list"
//					}
				]
			},
			// Generic code blocks (indented by 4 spaces)
			{
				begin: "^( {4,}|\\t)",
				end: "^$|\\n", // empty line ends it
				captures: {},
				contentName: "comment.meta.code", // TODO: abuse of tag names
			},
			// Fenced code blocks (GitHub extension) -- js
			{
				begin: "^(```(?:js|javascript))",
				end: "^(```)",
				captures: {
					1: { name: "entity.name.fenced" }
				},
				contentName: "source.markdown.embedded.js",
				patterns: [
					{
						include: "orion.js"
					}
				]
			},
			// Fenced code blocks (GitHub extension) -- generic
			{
				begin: "^(```)", //begin: "^(```)(?!js|javascript)",
				end: "^(```)",
				captures: {
					1: { name: "entity.name.fenced" }
				},
				contentName: "comment.meta.code"  // TODO: abuse of tag names
			},
			// **** Span Elements ****
			// Links
			// http://daringfireball.net/projects/markdown/syntax#link
			{	match: "(^\\[.*\\]: ?[\\w:/.\\?\\&=_-]+( \".*\")?$)|(\\[.*\\](\\(.*\\))?)",
				name: "entity.name.link"
			},
			// _Emphasis_ *Emphasis* __Emphasis__ **Emphasis**
			{
				// Ordering is important here: __ and ** must be tried before _ and *, so we get largest possible match
				match: "(__|_|\\*\\*|\\*).+?\\1",
				name: "keyword.emphasis"
			},
			// Inline code
			{
				match: "(`{1,})( ?)(.*?)\\2(\\1)", // one or more backticks, optional space, contents, matching optional space, matching backticks.
				captures: {
					1: { name: "entity.name.code.inline" },
					3: { name: "comment.meta.code" },        // TODO: abuse of tag names
					4: { name: "entity.name.code.inline" }
				}
			},
		]
	});
	return {
		id: grammars[grammars.length - 1].id,
		grammars: grammars,
		keywords: []
	};
});
