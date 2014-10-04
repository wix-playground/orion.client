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
/*eslint-env browser, amd, mocha */
/*eslint no-unused-vars:0 */
/*global URL*/

/**
 * Tests the orion.edit.command extensions.
 */
define([
	"chai/chai",
	"js-tests/editor/mockEditor",
	"orion/contentTypes",
	"orion/Deferred",
	"orion/editorCommands",
	"orion/inputManager",
	"orion/progress",
	"orion/serviceregistry",
	"orion/URL-shim", // no exports
], function(chai, MockEditor, mContentTypes, Deferred, mEditorCommands, mInputManager, mProgress, mServiceRegistry) {
	var EDITOR_COMMAND = "orion.edit.command",
	    FRAME_URL = "/abcdefghi", //"http://example.org/foo";
	    assert = chai.assert;

	// Test variables
	var serviceRegistry, contentTypeRegistry, progress, editorCommandFactory, inputManager, mockEditor,
	    initialFrames;

	function setup() {
		serviceRegistry = new mServiceRegistry.ServiceRegistry();
		contentTypeRegistry = new mContentTypes.ContentTypeRegistry(serviceRegistry);
		progress = new mProgress.ProgressService(serviceRegistry);
		inputManager =  new mInputManager.InputManager({
			serviceRegistry: serviceRegistry,
		});
		editorCommandFactory = new mEditorCommands.EditorCommandFactory({
			inputManager: inputManager,
			serviceRegistry: serviceRegistry
		});
		mockEditor = new MockEditor({});
		mockEditor.installTextView();
		initialFrames = Array.prototype.map.call(document.getElementsByTagName("iframe"), function(iframe) {
			return iframe.src;
		});
	}

	function teardown() {
		serviceRegistry = contentTypeRegistry = editorCommandFactory = inputManager = mockEditor = null;
		// Remove any iframes created during the test
		Array.prototype.forEach.call(document.getElementsByTagName("iframe"), function(iframe) {
			if (initialFrames.indexOf(iframe.src) === -1)
				iframe.parentNode.removeChild(iframe);
		});
	}

	function registerMessageService(impl) {
		if (!(serviceRegistry.getService("orion.page.message"))) {
			impl = impl || {};
			impl.setProgressMessage = impl.setProgressMessage || Function.prototype; // noop
			impl.setProgressResult  = impl.setProgressResult  || Function.prototype; // noop
			serviceRegistry.registerService("orion.page.message", impl);
		}
	}

	function registerEditorCommand(impl) {
		serviceRegistry.registerService(EDITOR_COMMAND, impl, {
			id: "example",
			name: "Example Command",
		});
	}

	function executeCommand() {
		// Due to the service dependency editorCommands -> orion.page.progress -> orion.page.message,
		// a message service must be registered before we invoke an editor command, else it will throw.
		registerMessageService();

		return editorCommandFactory._createEditCommands(mockEditor).then(function(commandObjects) {
			commandObjects.some(function(obj) {
				if (obj.info.id === "example") {
					// Execute command programatically
					obj.command.callback(/* .. */);
					return true;
				}
			});
		});
	}

	function assertFrameExists(url) {
		var found = Array.prototype.slice.call(document.getElementsByTagName("iframe")).some(function(frame) {
			return new URL(frame.src).pathname.indexOf(url) === 0;
		});
		assert.equal(found, true, "Found the iframe " + url + " in the page");
	}

	describe("orion.edit.command", function() {
		beforeEach(setup);
		afterEach(teardown);

		it("should set status for return value with 'status'", function() {
			// TODO
			assert.ok(false);
		});
		it("should set editor text for return value with 'text'", function() {
			// TODO
			assert.ok(false);
		});
		it("should set editor text for return value with 'selection'", function() {
			// TODO
			assert.ok(false);
		});

		describe("delegated UI", function() {
			describe("legacy", function() {
				it("should open frame for return value with 'uriTemplate'", function() {
					registerEditorCommand({
						run: function() {
							return {
								uriTemplate: FRAME_URL
							};
						}
					});
					var promise = new Deferred();
					executeCommand();
					setTimeout(function() {
						// Ensure the frame was opened
						assertFrameExists(FRAME_URL);
						promise.resolve();
					});
					return promise;
				});
			});
			describe("callback-based", function() {
				it("#openDelegatedUI() should open frame", function() {
					var promise = new Deferred();
					registerEditorCommand({
						execute: function(callbacks/*, options*/) {
							var c = callbacks.openDelegatedUI({
								id: "example.delegated",
								uriTemplate: FRAME_URL,
							});
							// FIXME #openDelegatedUI returns undefined?
							setTimeout(function() {
								assertFrameExists(FRAME_URL);
								promise.resolve();
							}, 0);
						}
					});
					executeCommand();
					return promise;
				});
				it("should be able to set status from frame", function() {
					registerEditorCommand({
						execute: function(callbacks/*, options*/) {
							callbacks.openDelegatedUI({
								id: "example",
								uriTemplate: "./editCommands/frame.html?source=example&action=status&message=howdy", // relative to uiTests.html
							});
						}
					});

					var promise = new Deferred();
					registerMessageService({
						setProgressResult: function(status) {
							// Ensure the message service was invoked with the status sent by the the frame
							assert.equal(status.Message, "howdy");
							promise.resolve();
						}
					});
					executeCommand();
					return promise;
				});
			});
		});
	});
});