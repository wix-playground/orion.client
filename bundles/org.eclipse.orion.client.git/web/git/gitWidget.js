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
 
/*globals define document */

define("git/gitWidget", [ //$NON-NLS-0$
	"require"
], function(require) {

	function gitWidget(options) {
		var doc = options.document || document;
		var parent = options.parent;
		var gitUri = options.uri;
		
		if (!parent) { parent = "gitWidget"; } //$NON-NLS-0$
		if (typeof(parent) === "string") { //$NON-NLS-0$
			parent = doc.getElementById(parent);
		}
		var iframe = document.createElement("iframe"); //$NON-NLS-0$
		parent.appendChild(iframe);
		
		iframe.id = "gitFrame";
		//iframe.name = name;
		iframe.type = "text/html"; //$NON-NLS-0$
		iframe.sandbox = "allow-scripts allow-same-origin"; //$NON-NLS-0$
		iframe.frameBorder = 0;
		var frameElement = document.getElementById('gitFrame'); // get the frame
		frameElement.addEventListener('load', function () {
			var win = frameElement.contentWindow;
			win["orionNoTrim" ] = "true";
		});
		iframe.src = "../../../git/git-repository.html";
		if (options.width) {
			iframe.style.width = options.width;
		} else {
			iframe.style.width = "100%";
		}
		if (options.height) {
			iframe.style.height = options.height;
		} else {
			iframe.style.height = "100%";
		}
		return iframe;
	}

	
	return gitWidget;
});

