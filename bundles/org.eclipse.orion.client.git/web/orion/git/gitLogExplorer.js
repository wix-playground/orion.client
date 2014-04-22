/******************************************************************************* 
 * @license
 * Copyright (c) 2011, 2013 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global define console document Image */

define([
	'require',
	'i18n!git/nls/gitmessages',
	'orion/git/widgetsTake2/gitCommitList',
	'orion/Deferred',
	'orion/URITemplate',
	'orion/globalCommands', 
	'orion/git/gitCommands',
	'orion/i18nUtil',
	'orion/PageUtil',
	'orion/webui/littlelib'
], function(require, messages, mGitCommitList, Deferred, URITemplate, mGlobalCommands, mGitCommands, i18nUtil, PageUtil, lib) {
var exports = {};

var repoTemplate = new URITemplate("git/git-repository.html#{,resource,params*}"); //$NON-NLS-0$
var logTemplate = new URITemplate("git/git-log.html#{,resource,params*}?page=1"); //$NON-NLS-0$
	
exports.GitLogExplorer = (function() {
	
	/**
	 * Creates a new Git log explorer.
	 * @class Git repository explorer
	 * @name orion.git.GitLogExplorer
	 * @param registry
	 * @param commandService
	 * @param linkService
	 * @param selection
	 * @param parentId
	 * @param actionScopeId
	 */
	function GitLogExplorer(serviceRegistry, fileClient, commandService, selection, options, parentId, pageTitleId, toolbarId, selectionToolsId, pageNavId, actionScopeId) {
		this.registry = serviceRegistry;
		this.fileClient = fileClient;
		this.commandService = commandService;
		this.selection = selection;
		
		this.checkbox = options !== null ? options.checkbox : true;
		this.minimal = options !== null ? options.minimal : false;
		
		this.parentId = parentId;
		this.pageTitleId = pageTitleId;
		this.toolbarId = toolbarId;
		this.selectionToolsId = selectionToolsId;
		this.pageNavId = pageNavId;
		this.actionScopeId = actionScopeId || options.actionScopeId;
		
		this.incomingCommits = [];
		this.outgoingCommits = [];
	}
	
	GitLogExplorer.prototype.getCloneFileUri = function(){
		var fileURI;
		
		var pageParams = PageUtil.matchResourceParameters();
		var path = pageParams.resource.split("gitapi/commit/"); //$NON-NLS-0$
		if(path.length === 2){
			path = path[1].split("/"); //$NON-NLS-0$
			if(path.length > 1){
				fileURI = "";
				for(var i = 0; i < path.length - 1; i++){
					fileURI += "/" + path[i]; //$NON-NLS-0$
				}
				fileURI += "/" + path[path.length - 1].split("?")[0]; //$NON-NLS-1$ //$NON-NLS-0$
			}
		}
		return fileURI;
	};
	
	GitLogExplorer.prototype.makeHref = function(fileClient, seg, location, isRemote) {
		if (!location) {
			return;
		}

		this.registry.getService("orion.page.progress").progress(fileClient.read(location, true), "Getting git informatiob about " + location).then(
			function(metadata) {
				if (isRemote) {
					var gitService = this.registry.getService("orion.git.provider"); //$NON-NLS-0$
					if (metadata.Git) {
						this.registry.getService("orion.page.progress").progress(
								gitService.getDefaultRemoteBranch(metadata.Git.RemoteLocation),
								"Getting default branch for " + metadata.Name).then(function(defaultRemoteBranchJsonData, secondArg) {
							seg.href = require.toUrl(logTemplate.expand({resource: defaultRemoteBranchJsonData.Location}));
						});
					}
				} else {
					if (metadata.Git) {
						seg.href = require.toUrl(logTemplate.expand({resource: metadata.Git.CommitLocation}));
					}
				}
			}, function(error) {
				console.error("Error loading file metadata: " + error.message); //$NON-NLS-0$
			});
	};
	
	GitLogExplorer.prototype.initTitleBar = function(item){
		var deferred = new Deferred();
		var isRemote = (item.toRef && item.toRef.Type === "RemoteTrackingBranch"); //$NON-NLS-0$
		var isBranch = (item.toRef && item.toRef.Type === "Branch"); //$NON-NLS-0$
		
		//TODO we are calculating file path from the URL, it should be returned by git API
		var fileURI, branchName;
		if (isRemote || isBranch) {
			fileURI = item.ContentLocation + item.RepositoryPath;
			branchName = item.toRef.Name;
		} else {
			fileURI = this.getCloneFileUri();
		}
			
		var that = this;
		
		if(fileURI){		
			this.registry.getService("orion.page.progress").progress(this.fileClient.read(fileURI, true), "Getting metadata of " + fileURI).then(
				function(metadata) {
					this.isDirectory = metadata.Directory;
					
					/* breadcrumb target item */
					var breadcrumbItem = {};
					
					breadcrumbItem.Parents = [];
					breadcrumbItem.Name = metadata.ETag ? i18nUtil.formatMessage(messages["Log (0) - 1"], branchName, metadata.Name) : i18nUtil.formatMessage(messages["Log (0)"], branchName);
										
					breadcrumbItem.Parents[0] = {};
					breadcrumbItem.Parents[0].Name = item.Clone.Name;
					breadcrumbItem.Parents[0].Location = item.Clone.Location;
					breadcrumbItem.Parents[0].ChildrenLocation = item.Clone.Location;
					breadcrumbItem.Parents[1] = {};
					breadcrumbItem.Parents[1].Name = messages.Repo;
					
					mGlobalCommands.setPageTarget({
						task : messages["Git Log"],
						target : item,
						breadcrumbTarget : breadcrumbItem,
						makeBreadcrumbLink : function(seg, location) {
							seg.href = require.toUrl(repoTemplate.expand({resource: location || "".Location})); //$NON-NLS-0$
						},
						serviceRegistry : that.registry,
						commandService : that.commandService
					});
					
					mGitCommands.updateNavTools(that.registry, that.commandService, that, "pageActions", "selectionTools", item); //$NON-NLS-1$ //$NON-NLS-0$
					deferred.resolve();
				}.bind(this), function(error) { 
					deferred.reject(error);
				}
			);
		} else {
			deferred.resolve();
		}
		return deferred;
	};
	
	GitLogExplorer.prototype.redisplay = function(){
		var pageParams = PageUtil.matchResourceParameters();
		this.display(pageParams.resource);
	};
	
	GitLogExplorer.prototype.changedItem = function(parent, children) {
		this.redisplay();
	};
	
	GitLogExplorer.prototype.getOutgoingIncomingChanges = function(resource){
		var that = this;
		var d = new Deferred();
		
		var progressService = this.registry.getService("orion.page.message");
		progressService.showWhile(d, messages["Getting git incoming changes..."]);
	
		var processRemoteTrackingBranch = function(remoteResource) {
			var newRefEncoded = encodeURIComponent(remoteResource.FullName);
			
			// update page navigation
			if (that.toolbarId && that.selectionToolsId){
				mGitCommands.updateNavTools(that.registry, that.commandService, that, that.toolbarId, that.selectionToolsId, remoteResource, that.pageNavId);
			}
			
			var pageParams = PageUtil.matchResourceParameters();
			
			that.registry.getService("orion.page.progress").progress(that.registry.getService("orion.git.provider").getLog(remoteResource.HeadLocation, newRefEncoded), "Getting log for " + remoteResource.Name).then(function(scopedCommitsJsonData) {
				that.incomingCommits = scopedCommitsJsonData.Children;
				that.outgoingCommits = [];
				
				var url = document.createElement("a");
				url.href = pageParams.resource;	
				
				that.registry.getService("orion.page.progress").progress(that.registry.getService("orion.git.provider").doGitLog(remoteResource.CommitLocation + url.search), "Getting incomming changes for " + remoteResource.Name).then(function(jsonData) { //$NON-NLS-0$
					remoteResource.Children = jsonData.Children;
					if(jsonData.NextLocation){
						var url = document.createElement("a");
						url.href = jsonData.NextLocation;
						remoteResource.NextLocation = remoteResource.Location + url.search; //$NON-NLS-0$
					}
					
					if(jsonData.PreviousLocation ){
						var url = document.createElement("a");
						url.href = jsonData.PreviousLocation;
						remoteResource.PreviousLocation  = remoteResource.Location + url.search; //$NON-NLS-0$
					}
					
					d.resolve(remoteResource);
				});
			});
		};
											
		if (resource.Type === "RemoteTrackingBranch"){ //$NON-NLS-0$
			processRemoteTrackingBranch(resource);
		} else if (resource.Type === "Commit" && resource.toRef.Type === "RemoteTrackingBranch"){ //$NON-NLS-1$ //$NON-NLS-0$
			processRemoteTrackingBranch(resource.toRef);
		} else if (resource.toRef){
			if (resource.toRef.RemoteLocation && resource.toRef.RemoteLocation.length===1 && resource.toRef.RemoteLocation[0].Children && resource.toRef.RemoteLocation[0].Children.length===1){
				that.registry.getService("orion.page.progress").progress(that.registry.getService("orion.git.provider").getGitRemote(resource.toRef.RemoteLocation[0].Children[0].Location), "Getting log for " + resource.Name).then(
					function(remoteJsonData, secondArg) {
						that.registry.getService("orion.page.progress").progress(that.registry.getService("orion.git.provider").getLog(remoteJsonData.CommitLocation, "HEAD"), "Getting outgoing changes for " + resource.Name).then(function(scopedCommitsJsonData) { //$NON-NLS-0$
							that.incomingCommits = [];
							that.outgoingCommits = scopedCommitsJsonData.Children;
							d.resolve(resource);
						});
					}
				);
			} else {
				d.resolve(resource);
			}
		} else {
			d.resolve(resource);
		}
		
		return d;
	};
	
	GitLogExplorer.prototype.handleError = function(error) {
		var display = {};
		display.Severity = "Error"; //$NON-NLS-0$
		display.HTML = false;
		try {
			var resp = JSON.parse(error.responseText);
			display.Message = resp.DetailedMessage ? resp.DetailedMessage : resp.Message;
		} catch (Exception) {
			display.Message = error.DetailedMessage || error.Message || error.message;
		}
		this.registry.getService("orion.page.message").setProgressResult(display); //$NON-NLS-0$
	};
	
	GitLogExplorer.prototype.loadResource = function(location){
		var that = this;
		var progressService = this.registry.getService("orion.page.message");
		var gitService = this.registry.getService("orion.git.provider"); //$NON-NLS-0$
		var loadingDeferred = this.registry.getService("orion.page.progress").progress(gitService.doGitLog(location), "Getting git log").then(
			function(resp) {
				var resource = resp;
				return that.registry.getService("orion.page.progress").progress(gitService.getGitClone(resource.CloneLocation), "Getting repository details for " + resource.Name).then(
					function(resp){
						var clone = resp.Children[0];	
						resource.Clone = clone;
						resource.ContentLocation = clone.ContentLocation;
						return that.registry.getService("orion.page.progress").progress(gitService.getGitBranch(clone.BranchLocation), "Getting default branch details for " + resource.Name).then(
							function(branches){
								for(var i=0; i<branches.Children.length; i++){
									var branch = branches.Children[i];
									
									if (branch.Current === true){
										resource.Clone.ActiveBranch = branch.CommitLocation;
										return resource;
									}
								}
							}
						);
					}
				);
			}
		);
		progressService.showWhile(loadingDeferred, messages['Loading git log...']);
		return loadingDeferred;
	};
	
	GitLogExplorer.prototype.display = function(location){
		var that = this;
		var progressService = this.registry.getService("orion.page.message"); //$NON-NLS-0$
		
		var loadingDeferred = new Deferred();
		progressService.showWhile(loadingDeferred, messages['Loading...']);
		
		that.loadResource(location).then(
			function(resp){
				var resource = resp;
				loadingDeferred.resolve();
				that.initTitleBar(resource).then(
					function(){
						that.getOutgoingIncomingChanges(resource).then(function(items){
							// update page navigation
							if (that.toolbarId && that.selectionToolsId){
								mGitCommands.updateNavTools(that.registry, that.commandService, that, that.toolbarId, that.selectionToolsId, items, that.pageNavId);
							}
						
							that.displayLog(items.Children);
						});
					}
				);
			},
			function(err){
				loadingDeferred.resolve();
				that.handleError(err);
			}
		);
	};

	GitLogExplorer.prototype.displayLog = function(commits){
		
		var tableNode = lib.node('table'); //$NON-NLS-0$
		var contentParent = document.createElement("div");
		contentParent.className = "sectionTable";
		tableNode.appendChild(contentParent);
		var logNode  = document.createElement("div");
		logNode.id = "logNode";
		logNode.className = "mainPadding";
		contentParent.appendChild(logNode);
		
		new mGitCommitList.GitCommitListExplorer({
			serviceRegistry: this.registry,
			commandRegistry: this.commandService,
			selection: this.selection,
			actionScopeId: this.actionScopeId,
			parentId: logNode,
			incomingCommits: this.incomingCommits,
			outgoingCommits: this.outgoingCommits,
			commits: commits
		});
	}
	return GitLogExplorer;
}());

return exports;

// end of define
});
