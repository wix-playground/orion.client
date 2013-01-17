/*******************************************************************************
 * @license
 * Copyright (c) 2010, 2013 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global window define XMLHttpRequest BlobBuilder*/
/*jslint forin:true devel:true browser:true*/


define(["orion/xhr", "plugins/filePlugin/fileImpl"], function(xhr, FileImpl) {
	var temp = document.createElement('a');
	function makeAbsolute(location) {
		temp.href = location;
		return temp.href;
	}
	function _normalizeLocations(data) {
		if (data && typeof data === "object") {
			Object.keys(data).forEach(function(key) {
				var value = data[key];
				if (key.indexOf("Location") !== -1) {
					data[key] = makeAbsolute(value);
				} else {
					_normalizeLocations(value);
				}
			});
		}
		return data;
	}
	
	/**
	 * An implementation of the file service that understands the Orion 
	 * server file API. This implementation is suitable for invocation by a remote plugin.
	 */
	/**
	 * @class Provides operations on files, folders, and projects.
	 * @name FileServiceImpl
	 */
	function SFTPFileServiceImpl(fileBase, workspaceBase) {
		this.fileBase = fileBase;
		this.workspaceBase = workspaceBase;
		this.makeAbsolute = workspaceBase && workspaceBase.indexOf("://") !== -1;
	}
	
	SFTPFileServiceImpl.prototype = new FileImpl();
	
	/**
	 * Loads the workspace with the given id and sets it to be the current
	 * workspace for the IDE. The workspace is created if none already exists.
	 * @param {String} location the location of the workspace to load
	 * @param {Function} onLoad the function to invoke when the workspace is loaded
	 */
	SFTPFileServiceImpl.prototype.loadWorkspace = function(location) {
		if (location===this.fileBase) {
			location = null;
		}
		return xhr("GET", location ? location : this.workspaceBase, {
			headers: {
				"Orion-Version": "1"
			},
			timeout: 15000,
			log: false
		}).then(function(result) {
			var jsonData = result.response ? JSON.parse(result.response) : {};
			//in most cases the returned object is the workspace we care about
			if (location) {
				//sftp service cares only about drives
				jsonData.Children = jsonData.Drives;
				return jsonData;
			} else {
				//user didn't specify a workspace so we are at the root
				//just pick the first location in the provided list
				if (jsonData.Workspaces.length > 0) {
					return this.loadWorkspace(jsonData.Workspaces[0].Location);
				} else {
					//no workspace exists, and the user didn't specify one. We'll create one for them
					return this._createWorkspace("Orion Content");
				}
			}
		}.bind(this)).then(function(result) {
			if (this.makeAbsolute) {
				_normalizeLocations(result);
			}
			return result;
		}.bind(this));
	};


	
	return SFTPFileServiceImpl;
});