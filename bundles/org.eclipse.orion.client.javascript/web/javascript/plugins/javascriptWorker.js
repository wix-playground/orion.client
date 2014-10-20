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
/*global importScripts*/
/*eslint-env amd*/

/**
 * This file is invoked to initialize the JS plugin. It may be loaded in 2 contexts:
 *
 * 1) As a web worker script via `new Worker("javascriptWorker.js").
 * In this mode it configures RequireJS in the worker's global environment, then initializes the JS plugin.
 *
 * 2) In a regular Window.
 * In this mode it simply initializes the JS plugin.
 */
(function(factory) {
	if (typeof define === "function" && define.amd && typeof importScripts === "undefined") {
		// Case 1
		define(factory);
	} else if (typeof importScripts === "function") {
		// Case 2
		importScripts("../../requirejs/require.js"); // synchronous
		require.config({
			baseUrl: "../../",
			paths: {
				text: "requirejs/text",
				esprima: "esprima/esprima",
				estraverse: "estraverse/estraverse",
				escope: "escope/escope",
				logger: "javascript/logger",
				doctrine: 'doctrine/doctrine'
			},
			packages: [
				{
					name: "eslint",
					location: "eslint/lib",
					main: "eslint"
				},
				{
					name: "eslint/conf",
					main: "eslint/conf"
			}]
		});
		factory();
	} else {
		throw new Error("Unsupported global context");
	}
}(function() {
	/**
	 * Set up the plugin. This happens in several stages:
	 *
	 * 1) Create the PluginProvider. This causes a loading() callback to the framework, which prevents it from
	 * timeout'ing us after 5 seconds. This is important in the worker case when running an un-optimized build
	 * of Orion, as javascriptPlugin takes longer than 5 seconds to load.
	 * 2) Load javascriptPlugin.
	 * 3) Register the actual services against the PluginProvider.
	 */
	// TODO can we move orion/plugin up into the importScripts() call?
	require(["orion/plugin"], function(PluginProvider) {
		console.log("Creating plugin provider");
		/**
		 * Plug-in headers
		 */
		var headers = {
			name: "Orion JavaScript Tool Support", //$NON-NLS-0$
			version: "1.0", //$NON-NLS-0$
			description: "This plugin provides JavaScript tools support for Orion, like editing, search, navigation, validation, and code completion." //$NON-NLS-0$
		};
		var provider = new PluginProvider(headers);

		require(["javascript/plugins/javascriptPlugin"], function(jsPluginFactory) {
			console.log("Loaded javascriptPlugin. Registering services..");
			jsPluginFactory(provider);
		});
	});
}));
