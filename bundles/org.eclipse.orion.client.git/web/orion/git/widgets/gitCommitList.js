/*******************************************************************************
 * @license Copyright (c) 2014 IBM Corporation and others. All rights
 *          reserved. This program and the accompanying materials are made
 *          available under the terms of the Eclipse Public License v1.0
 *          (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse
 *          Distribution License v1.0
 *          (http://www.eclipse.org/org/documents/edl-v10.html).
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global define document Image*/

define([
	'require',
	'i18n!git/nls/gitmessages',
	'orion/Deferred',
	'orion/explorers/explorer',
	'orion/URITemplate',
	'orion/git/util',
	'orion/i18nUtil',
	'orion/PageUtil',
	'orion/explorers/navigationUtils',
	'orion/git/widgets/CommitTooltipDialog',
	'orion/webui/littlelib',
	'orion/objects'
], function(require, messages, Deferred, mExplorer, URITemplate, util, i18nUtil, PageUtil, mNavUtils, mCommitTooltip, lib, objects) {
	var commitTemplate = new URITemplate("git/git-commit.html#{,resource,params*}?page=1&pageSize=1"); //$NON-NLS-0$
	var logTemplate = new URITemplate("git/git-log.html#{,resource,params*}?page=1"); //$NON-NLS-0$

	function GitCommitListModel(options) {
		this.root = options.root;
		this.section = options.section;
		this.location = options.location;
		this.handleError = options.handleError;
		this.repository = options.repository;
		this.progressService = options.progressService;
		this.statusService = options.statusService;
		this.gitClient = options.gitClient;
		this.progressService = options.progressService;
	}
	GitCommitListModel.prototype = Object.create(mExplorer.Explorer.prototype);
	objects.mixin(GitCommitListModel.prototype, /** @lends orion.git.GitCommitListModel.prototype */ {
		destroy: function(){
		},
		getRoot: function(onItem){
			onItem(this.root);
		},
		_getRepository: function() {
			var that = this;
			return Deferred.when(that.log || that._getLog(), function(log) {
				return that.progressService.progress(that.gitClient.getGitClone(log.CloneLocation), "Getting repository details for " + log.Name).then(function(resp) { //$NON-NLS-0$
					var repository = resp.Children[0];
					log.Clone = repository;
					log.ContentLocation = repository.ContentLocation;
					return that.root.repository = repository;
				});
			}, function(error){
				that.handleError(error);
			});
		},
		_getLog: function() {
			var that = this;
			return that.progressService.progress(that.gitClient.doGitLog(that.location || (that.currentBranch.CommitLocation + "?page=1&pageSize=20")), that.location ? "Getting git log" : i18nUtil.formatMessage(messages['Getting commits for \"${0}\" branch'], that.currentBranch.Name)).then(function(resp) { //$NON-NLS-1$ //$NON-NLS-0$
				return that.log = resp;
			}, function(error){
				that.handleError(error);
			});
		},
		_getOutgoing: function() {
			var that = this;
			var location, id, ref;
			if (that.log) {
				ref = that.log.toRef;
			} else {
				ref = that.currentBranch;
			}
			if (ref.Type === "RemoteTrackingBranch") {
				location = ref.CommitLocation;
				id = that.trackingBranch.Name;
			} else {
				location = ref.RemoteLocation[0].Children[0].CommitLocation + (that.log ? that.log.RepositoryPath : "");
				id = ref.Name;
			}
			return that.progressService.progress(that.gitClient.getLog(location + "?page=1&pageSize=20", id), i18nUtil.formatMessage(messages['Getting commits for \"${0}\" branch'], ref.Name)).then(function(resp) {//$NON-NLS-1$ //$NON-NLS-0$
				return that.outgoingCommits = resp.Children;
			});
		},
		_getIncoming: function() {
			var that = this;
			var location, id, ref;
			if (that.log) {
				ref = that.log.toRef;
			} else {
				ref = that.currentBranch;
			}
			if (ref.Type === "RemoteTrackingBranch") {
				location = this.trackingBranch.CommitLocation;
				id = ref.Name;
			} else {
				location = ref.CommitLocation + (that.log ? that.log.RepositoryPath : "");
				id = ref.RemoteLocation[0].Children[0].Name;
			}
			return that.progressService.progress(that.gitClient.getLog(location + "?page=1&pageSize=20", id), messages['Getting outgoing commits']).then(function(resp) { //$NON-NLS-1$ //$NON-NLS-0$
				return that.incomingCommits = resp.Children;
			});
		},
		tracksRemoteBranch: function(){
			var ref = (this.log && this.log.toRef) || this.currentBranch ;
			if (ref && ref.Type === "RemoteTrackingBranch" && (this.root.repository && this.root.repository.Branches)) {
				var result = false;
				var that = this;
				this.root.repository.Branches.some(function(branch){
					if (branch.RemoteLocation && branch.RemoteLocation.length === 1 && branch.RemoteLocation[0].Children.length === 1) {
						if (branch.RemoteLocation[0].Children[0].Name === ref.Name) {
							that.trackingBranch = branch;
							result = true;
							return true;
						}
					}
					return false;
				});
				return result;
			} 
			return ref && ref.RemoteLocation && ref.RemoteLocation.length === 1 && ref.RemoteLocation[0].Children.length === 1;
		},
		getChildren: function(parentItem, onComplete) {
			var that = this, currentBranch = this.currentBranch;
			var tracksRemoteBranch = this.tracksRemoteBranch();
			if (parentItem instanceof Array && parentItem.length > 0) {
				onComplete(parentItem);
			} else if (parentItem.Type === "CommitRoot") { //$NON-NLS-0$
				var section = this.section;
				var progress = section.createProgressMonitor();
				progress.begin(messages['Getting current branch']);
				Deferred.when(parentItem.repository || that._getRepository(), function(repository) {
					that.progressService.progress(that.gitClient.getGitBranch(repository.BranchLocation), "Getting current branch " + repository.Name).then(function(resp) { //$NON-NLS-0$
						var currentBranch;
						resp.Children.some(function(branch) {
							if (branch.Current) {
								currentBranch = branch;
								return true;
							}
							return false;
						});
						that.currentBranch = currentBranch;
						if (!that.currentBranch || !currentBranch.RemoteLocation[0]) {
							section.setTitle(messages["RebaseProgress"]);
							progress.done();
							onComplete([
							//TODO help message
							]);
							return;
						}
						repository.ActiveBranch = currentBranch.CommitLocation;
						repository.Branches = resp.Children;
						section.setTitle(i18nUtil.formatMessage(messages["Commits for \"${0}\" branch"], that.log ? that.log.toRef.Name : currentBranch.Name));
						progress.done();
						onComplete([
							{
								Type: "Outgoing"
							},
							{
								Type: "Incoming"
							},
							{
								Type: "Sync"
							}
						]);
					}, function(error){
						progress.done();
						that.handleError(error);
					});
				}, function(error){
					progress.done();
					that.handleError(error);
				});
			} else if (parentItem.Type === "Incoming") { //$NON-NLS-0$
				if (tracksRemoteBranch) {
					Deferred.when(that.incomingCommits || that._getIncoming(), function(incomingCommits) {
						onComplete(that.checkEmptyList(incomingCommits));
					}, function(error) {
						that.handleError(error);
					});
				} else {
					return Deferred.when(that.log || that._getLog(), function(log) {
						var children = [];
						if (log.toRef.Type === "RemoteTrackingBranch") {
							children = log.Children;
						}
						onComplete(that.checkEmptyList(children));
					}, function(error){
						that.handleError(error);
					});
				}
			} else if (parentItem.Type === "Outgoing") { //$NON-NLS-0$
				if (tracksRemoteBranch) {
					Deferred.when(that.outgoingCommits || that._getOutgoing(), function(outgoingCommits) {
						onComplete(that.checkEmptyList(outgoingCommits));
					}, function(error){
						that.handleError(error);
					});
				} else {
					return Deferred.when(that.log || that._getLog(), function(log) {
						var children = [];
						if (log.toRef.Type === "Branch") {
							children = log.Children;
						} 
						onComplete(that.checkEmptyList(children));
					}, function(error){
						that.handleError(error);
					});
				}
			} else if (parentItem.Type === "Sync") { //$NON-NLS-0$
				if (tracksRemoteBranch) {
					return Deferred.when(that.log || that._getLog(), function(log) {
						var remoteBranch = log.toRef.Type === "RemoteTrackingBranch";
						Deferred.when(remoteBranch ? that.incomingCommits || that._getIncoming() : that.outgoingCommits || that._getOutgoing(), function(filterCommits) {
							var children = [];
							log.Children.forEach(function(commit) {
								if (!filterCommits.some(function(com) { return com.Name === commit.Name; })) {
									children.push(commit);
								}
							});
							onComplete(that.checkEmptyList(children));
						}, function(error){
							that.handleError(error);
						});
					}, function(error){
						that.handleError(error);
					});
				} else {
					onComplete(that.checkEmptyList([]));
				}
			} else {
				onComplete([]);
			}
		},
		getId: function(/* item */ item){
			return item.Name || item.Type;
		},
		checkEmptyList: function(items) {
			if (items.length === 0) {
				return [{Type: "NoCommits"}];
			}
			return items;
		}
	});
	
	/**
	 * @class orion.git.GitCommitListExplorer
	 * @extends orion.explorers.Explorer
	 */
	function GitCommitListExplorer(options) {
		var renderer = new GitCommitListRenderer({registry: options.serviceRegistry, commandService: options.commandRegistry, actionScopeId: options.actionScopeId, cachePrefix: "LogNavigator", checkbox: false}, this); //$NON-NLS-0$
		mExplorer.Explorer.call(this, options.serviceRegistry, options.selection, renderer, options.commandRegistry);	
		this.checkbox = false;
		this.parentId = options.parentId;
		this.actionScopeId = options.actionScopeId;
		this.section = options.section;
		this.root = options.root;
		this.handleError = options.handleError;
		this.location = options.location;
		this.gitClient = options.gitClient;
		this.progressService = options.progressService;
		this.statusService = options.statusService;
		
		this.incomingActionScope = "IncomingActions"; //$NON-NLS-0$
		this.outgoingActionScope = "OutgoingActions"; //$NON-NLS-0$
	}
	GitCommitListExplorer.prototype = Object.create(mExplorer.Explorer.prototype);
	objects.mixin(GitCommitListExplorer.prototype, /** @lends orion.git.GitCommitListExplorer.prototype */ {
		display: function() {
			var that = this;
			var deferred = new Deferred();
			var model = new GitCommitListModel({root: this.root, registry: this.registry, progressService: this.progressService, statusService: this.statusService, gitClient: this.gitClient, section: this.section, location: this.location, handleError: this.handleError});
			this.createTree(this.parentId, model, {onComplete: function() {
				that.status = model.status;
				that.updateCommands();
				deferred.resolve(model.log);
			}});
			return deferred;
		},
		updateCommands: function() {
			var currentBranch = this.model.currentBranch;
			var repository = this.root.repository;
			var commandService = this.commandService;
			var section = this.section;
			var actionsNodeScope = section.actionsNode.id;
			if (!currentBranch){
				commandService.registerCommandContribution(actionsNodeScope, "eclipse.orion.git.resetCommand", 100); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
				commandService.registerCommandContribution(actionsNodeScope, "eclipse.orion.git.rebaseContinueCommand", 200); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
				commandService.registerCommandContribution(actionsNodeScope, "eclipse.orion.git.rebaseSkipPatchCommand", 300); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
				commandService.registerCommandContribution(actionsNodeScope, "eclipse.orion.git.rebaseAbortCommand", 400); //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
				commandService.renderCommands(actionsNodeScope, actionsNodeScope, repository.status, this, "button"); //$NON-NLS-0$
			} else {
				var incomingActionScope = this.incomingActionScope;
				var outgoingActionScope = this.outgoingActionScope;
				if (lib.node(incomingActionScope)) {
					commandService.destroy(incomingActionScope);
				}
				if (lib.node(outgoingActionScope)) {
					commandService.destroy(outgoingActionScope);
				}
				
//				commandService.registerCommandContribution(actionsNodeScope, "eclipse.orion.git.repositories.viewAllCommand", 10); //$NON-NLS-0$
//				commandService.renderCommands(actionsNodeScope, actionsNodeScope, {
//					"ViewAllLink" : logTemplate.expand({resource: currentBranch.CommitLocation}),
//					"ViewAllLabel" : messages['See Full Log'],
//					"ViewAllTooltip" : messages["See the full log"]
//				}, this, "button"); //$NON-NLS-7$ //$NON-NLS-6$ //$NON-NLS-5$ //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
	
				var tracksRemoteBranch = this.model.tracksRemoteBranch();
				if (tracksRemoteBranch) {
					commandService.registerCommandContribution(incomingActionScope, "eclipse.orion.git.fetch", 100); //$NON-NLS-0$
					commandService.registerCommandContribution(incomingActionScope, "eclipse.orion.git.merge", 100); //$NON-NLS-0$
					commandService.registerCommandContribution(incomingActionScope, "eclipse.orion.git.rebase", 100); //$NON-NLS-0$
					commandService.registerCommandContribution(incomingActionScope, "eclipse.orion.git.resetIndex", 100); //$NON-NLS-0$
					commandService.renderCommands(incomingActionScope, incomingActionScope, currentBranch.RemoteLocation[0].Children[0], this, "button"); //$NON-NLS-0$
				}
	
				commandService.addCommandGroup(outgoingActionScope, "eclipse.gitPushGroup", 1000, "Push", null, null, null, "Push", null, "eclipse.orion.git.push"); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
				commandService.registerCommandContribution(outgoingActionScope, "eclipse.orion.git.push", 1100, "eclipse.gitPushGroup"); //$NON-NLS-0$ //$NON-NLS-1$
				commandService.registerCommandContribution(outgoingActionScope, "eclipse.orion.git.pushBranch", 1200, "eclipse.gitPushGroup"); //$NON-NLS-0$ //$NON-NLS-1$
				commandService.registerCommandContribution(outgoingActionScope, "eclipse.orion.git.pushToGerrit", 1200, "eclipse.gitPushGroup"); //$NON-NLS-0$ //$NON-NLS-1$
				commandService.renderCommands(outgoingActionScope, outgoingActionScope, currentBranch, this, "button"); //$NON-NLS-0$
			}
		},
	});
	
	function GitCommitListRenderer(options, explorer) {
		mExplorer.SelectionRenderer.apply(this, arguments);
	}
	GitCommitListRenderer.prototype = Object.create(mExplorer.SelectionRenderer.prototype);
	objects.mixin(GitCommitListRenderer.prototype, {
		getCellElement: function(col_no, item, tableRow){
			var explorer = this.explorer;
			var commit = item;
			switch(col_no){
			case 0:	
				var td = document.createElement("td"); //$NON-NLS-0$
				var sectionItem = document.createElement("div");
				td.appendChild(sectionItem);
				var horizontalBox = document.createElement("div");
				horizontalBox.style.overflow = "hidden";
				sectionItem.appendChild(horizontalBox);	
				var description;
				if (item.Type !== "Commit") {
					if (item.Type !== "NoCommits") {
						sectionItem.className = "gitCommitSectionTableItem";
						var expandContainer = document.createElement("div");
						expandContainer.style.display = "inline-block";
						expandContainer.style.styleFloat = "left";
						expandContainer.style.cssFloat = "left";
						this.getExpandImage(tableRow, expandContainer);
						horizontalBox.appendChild(expandContainer);
						tableRow.classList.add("gitCommitListSection");
					} else {
						tableRow.classList.add("gitComitListNoCommit");
						sectionItem.classList.add("sectionTableItem");
					}
					
					detailsView = document.createElement("div");
					detailsView.className = "stretch";
					horizontalBox.appendChild(detailsView);
					
					var title = document.createElement("div");
					title.textContent = messages[item.Type];
					if (item.Type !== "NoCommits") {
						title.classList.add("gitComitListSectionTitle");
					}
					detailsView.appendChild(title);
			
					var actionsArea = document.createElement("ul");
					actionsArea.className = "layoutRight commandList";
					actionsArea.id = item.Type + "Actions";
					horizontalBox.appendChild(actionsArea);
				} else {
					sectionItem.className = "sectionTableItem";
					if (commit.AuthorImage) {
						var authorImage = document.createElement("div");
						authorImage.style["float"] = "left";
						var image = new Image();
						image.src = commit.AuthorImage;
						image.name = commit.AuthorName;
						image.className = "git-author-icon";
						authorImage.appendChild(image);
						horizontalBox.appendChild(authorImage);
					}
					
					var detailsView = document.createElement("div");
					detailsView.className = "stretch";
					horizontalBox.appendChild(detailsView);
	
					var titleLink = document.createElement("a");
					titleLink.className = "navlinkonpage";
					titleLink.href = require.toUrl(commitTemplate.expand({resource: commit.Location})); //$NON-NLS-0$
					titleLink.textContent = util.trimCommitMessage(commit.Message);
					detailsView.appendChild(titleLink);
					
					//Add the commit page link as the first grid of the row
					mNavUtils.addNavGrid(this.explorer.getNavDict(), item, titleLink);
					
					new mCommitTooltip.CommitTooltipDialog({commit: commit, triggerNode: titleLink});
	
					var d = document.createElement("div");
					detailsView.appendChild(d);
	
					description = document.createElement("span");
					description.textContent = messages[" (SHA "] + commit.Name + messages[") by "] + commit.AuthorName + messages[" on "]
							+ new Date(commit.Time).toLocaleString();
					detailsView.appendChild(description);
					
					var itemActionScope = "itemLevelCommands";
					var actionsArea = document.createElement("ul");
					actionsArea.className = "layoutRight commandList";
					actionsArea.id = itemActionScope;
					horizontalBox.appendChild(actionsArea);
					explorer.commandService.renderCommands(itemActionScope, actionsArea, item, explorer, "tool"); //$NON-NLS-0$
				}

				return td;
			}
		},
		emptyCallback:function(bodyElement) {
			var tr = document.createElement("tr"); //$NON-NLS-0$
			var td = document.createElement("td"); //$NON-NLS-0$
			td.colSpan = 1;
			var noCommit = document.createElement("div"); //$NON-NLS-0$
			noCommit.classList.add("sectionTableItem"); //$NON-NLS-0$
			
			var title = document.createElement("div");
			title.textContent = messages["The branch is up to date."];
			noCommit.appendChild(title);
			
			var description = document.createElement("div");
			description.textContent = messages["You have no outgoing or incoming commits."];
			noCommit.appendChild(description);
			
			td.appendChild(noCommit);
			tr.appendChild(td);
			bodyElement.appendChild(tr);
		}
	});
	
	return {
		GitCommitListExplorer: GitCommitListExplorer,
		GitCommitListRenderer: GitCommitListRenderer
	};

});