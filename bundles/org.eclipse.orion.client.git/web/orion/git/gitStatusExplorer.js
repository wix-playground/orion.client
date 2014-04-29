/*******************************************************************************
 * @license Copyright (c) 2012, 2013 IBM Corporation and others. All rights
 *          reserved. This program and the accompanying materials are made
 *          available under the terms of the Eclipse Public License v1.0
 *          (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse
 *          Distribution License v1.0
 *          (http://www.eclipse.org/org/documents/edl-v10.html).
 *
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
/*global define document window Image*/
define([
	'require',
	'i18n!git/nls/gitmessages',
	'orion/git/widgetsTake2/gitCommitList',
	'orion/git/widgetsTake2/gitChangeList',
	'orion/explorers/explorer',
	'orion/selection',
	'orion/section',
	'orion/URITemplate',
	'orion/PageUtil',
	'orion/webui/littlelib',
	'orion/globalCommands',
	'orion/git/gitCommands'
], function(require, messages, mGitCommitList, mGitChangeList, mExplorer, mSelection, mSection, URITemplate, PageUtil, lib, mGlobalCommands, mGitCommands) {

	var exports = {};
	var conflictTypeStr = "Conflicting"; //$NON-NLS-0$

	var repoTemplate = new URITemplate("git/git-repository.html#{,resource,params*}"); //$NON-NLS-0$

	function isConflict(type) {
		return type === conflictTypeStr;
	}

	var GitStatusModel = (function() {
		function GitStatusModel() {
			this.selectedFileId = undefined;
			this.selectedItem = undefined;
			this.interestedUnstagedGroup = [ "Missing", "Modified", "Untracked", "Conflicting" ]; //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			this.interestedStagedGroup = [ "Added", "Changed", "Removed" ]; //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			this.conflictPatterns = [
				[ "Both", "Modified", "Added", "Changed", "Missing" ], [ "RemoteDelete", "Untracked", "Removed" ], [ "LocalDelete", "Modified", "Added", "Missing" ] ]; //$NON-NLS-11$ //$NON-NLS-10$ //$NON-NLS-9$ //$NON-NLS-8$ //$NON-NLS-7$ //$NON-NLS-6$ //$NON-NLS-5$ //$NON-NLS-4$ //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			this.conflictType = "Conflicting"; //$NON-NLS-0$

			this.statusTypeMap = {
				"Missing" : { imageClass: "gitImageSprite git-sprite-removal", tooltip: messages['Unstaged removal'] }, //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
				"Removed" : { imageClass: "gitImageSprite git-sprite-removal", tooltip: messages['Staged removal'] }, //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
				"Modified" : { imageClass: "gitImageSprite git-sprite-file", tooltip: messages['Unstaged change'] }, //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
				"Changed" : { imageClass: "gitImageSprite git-sprite-file", tooltip: messages['Staged change'] }, //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
				"Untracked" : { imageClass: "gitImageSprite git-sprite-addition", tooltip: messages["Unstaged addition"] }, //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
				"Added" : { imageClass: "gitImageSprite git-sprite-addition", tooltip: messages["Staged addition"] }, //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
				"Conflicting" : { imageClass: "gitImageSprite git-sprite-conflict-file", tooltip: messages['Conflicting'] } //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
			};
		}

		GitStatusModel.prototype = {
			destroy: function() {},

			interestedCategory: function() {},

			init: function(jsonData) {
				this.items = jsonData;
			},

			getModelType: function(groupItem, groupName) {
				return groupName;
			},

			_markConflict: function(conflictPattern) {
				// if git status server API response a file with "Modified"
				// ,"Added", "Changed","Missing" states , we treat it as a
				// conflicting file
				// And we add additional attribute to that groupItem :
				// groupItem.Conflicting = true;
				var baseGroup = this.getGroupData(conflictPattern[1]);
				if (!baseGroup)
					return;
				for (var i = 0; i < baseGroup.length; i++) {
					if (baseGroup[i].Conflicting)
						continue;
					var fileLocation = baseGroup[i].Location;
					var itemsInDetectGroup = [];

					for (var j = 2; j < conflictPattern.length; j++) {
						var groupName = conflictPattern[j];
						var groupData = this.getGroupData(groupName);
						if (!groupData)
							continue;
						var item = this._findSameFile(fileLocation, groupData);
						if (item) {
							itemsInDetectGroup.push(item);
						} else {
							continue;
						}
					}

					// we have the same file at "Modified" ,"Added",
					// "Changed","Missing" groups
					if (itemsInDetectGroup.length === (conflictPattern.length - 2)) {
						baseGroup[i].Conflicting = conflictPattern[0];
						for (var k = 0; k < itemsInDetectGroup.length; k++) {
							itemsInDetectGroup[k].Conflicting = "Hide"; //$NON-NLS-0$
						}
					}
				}
			},

			_findSameFile: function(fileLocation, groupData) {
				for (var j = 0; j < groupData.length; j++) {
					if (groupData[j].Conflicting)
						continue;
					if (fileLocation === groupData[j].Location)
						return groupData[j];
				}
				return undefined;
			},

			getGroupData: function(groupName) {
				return this.items[groupName];
			},

			isStaged: function(type) {
				for (var i = 0; i < this.interestedStagedGroup.length; i++) {
					if (type === this.interestedStagedGroup[i]) {
						return true;
					}
				}
				return false;
			},

			getClass: function(item) {
				return this.statusTypeMap[item.type].imageClass;
			},

			getTooltip: function(item) {
				return this.statusTypeMap[item.type].tooltip;
			}
		};

		return GitStatusModel;
	}());

	exports.GitStatusExplorer = (function() {
		/**
		 * Creates a new Git status explorer.
		 *
		 * @class Git status explorer
		 * @name orion.git.GitStatusExplorer
		 * @param registry
		 * @param commandService
		 * @param linkService
		 * @param selection
		 * @param parentId
		 * @param toolbarId
		 * @param selectionToolsId
		 * @param actionScopeId
		 */
		function GitStatusExplorer(registry, commandService, linkService, selection, parentId, toolbarId, selectionToolsId, actionScopeId) {
			this.parentId = parentId;
			this.registry = registry;
			this.commandService = commandService;
			this.linkService = linkService;
			this.selection = selection;
			this.parentId = parentId;
			this.toolbarId = toolbarId;
			this.selectionToolsId = selectionToolsId;
			this.checkbox = false;
			this.actionScopeId = actionScopeId;
			mExplorer.createExplorerCommands(commandService);
		}

		GitStatusExplorer.prototype.handleError = function(error) {
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

			if (error.status === 404) {
				this.initTitleBar();
				this.displayCommit();
			}
		};

		GitStatusExplorer.prototype.changedItem = function(parent, children) {
			this.redisplay();
		};

		GitStatusExplorer.prototype.redisplay = function() {
			var pageParams = PageUtil.matchResourceParameters();
			this.display(pageParams.resource);
		};

		GitStatusExplorer.prototype.display = function(location) {
			var that = this;
			var progressService = this.registry.getService("orion.page.progress"); //$NON-NLS-0$

			progressService
				.progress(this.registry.getService("orion.git.provider").getGitStatus(location), messages['Loading...']).then( //$NON-NLS-0$
				function(resp) {
					if (resp.Type === "Status") { //$NON-NLS-0$
						var status = resp;
						that._model = new GitStatusModel();
						that._model.init(status);

						progressService
							.progress(
								that.registry.getService("orion.git.provider").getGitClone(status.CloneLocation), "Getting repository information").then( //$NON-NLS-0$
								function(resp) {
									var repositories = resp.Children;

									progressService
										.progress(
											that.registry
												.getService("orion.git.provider").getGitCloneConfig(repositories[0].ConfigLocation), "Getting repository configuration ", repositories[0].Name).then( //$NON-NLS-0$
												function(resp) {
													var config = resp.Children;

													status.Clone = repositories[0];
													status.Clone.Config = [];

													for (var i = 0; i < config.length; i++) {
														if (config[i].Key === "user.name" || config[i].Key === "user.email") //$NON-NLS-1$ //$NON-NLS-0$
															status.Clone.Config.push(config[i]);
													}

													var tableNode = lib.node('table'); //$NON-NLS-0$
													lib.empty(tableNode);
													that.initTitleBar(status, repositories[0]);
													that.displayUnstaged(status, repositories[0]);
													that.displayStaged(status, repositories[0]);
													that.displayCommits(repositories[0]);

													// render
													// commands
													mGitCommands.updateNavTools(that.registry, that.commandService, that,
														"pageActions", "selectionTools", status); //$NON-NLS-1$ //$NON-NLS-0$
												}, function(error) {
													that.handleError(error);
												});
								}, function(error) {
									that.handleError(error);
								});
					}
				}, function(error) {
					that.handleError(error);
				});
		};

		GitStatusExplorer.prototype.initTitleBar = function(status, repository) {
			var item = {};

			// TODO add info about branch or detached
			item.Name = messages["Status"] + ((status.RepositoryState && status.RepositoryState.indexOf("REBASING") !== -1) ? messages[" (Rebase in Progress)"] : ""); //$NON-NLS-1$
			item.Parents = [];
			item.Parents[0] = {};
			item.Parents[0].Name = repository.Name;
			item.Parents[0].Location = repository.Location;
			item.Parents[0].ChildrenLocation = repository.Location;
			item.Parents[1] = {};
			item.Parents[1].Name = messages.Repo;

			mGlobalCommands.setPageTarget({
				task : messages["Status"],
				target : repository,
				breadcrumbTarget : item,
				makeBreadcrumbLink : function(seg, location) {
					seg.href = require.toUrl(repoTemplate.expand({resource: location || ""})); //$NON-NLS-0$
				},
				serviceRegistry : this.registry,
				commandService : this.commandService
			});
		};

		// helpers

		GitStatusExplorer.prototype._sortBlock = function(interestedGroup) {
			var retValue = [];
			for (var i = 0; i < interestedGroup.length; i++) {
				var groupName = interestedGroup[i];
				var groupData = this._model.getGroupData(groupName);
				if (!groupData)
					continue;
				for (var j = 0; j < groupData.length; j++) {
					var renderType = this._model.getModelType(groupData[j], groupName);
					if (renderType) {
						retValue.push({
							name : groupData[j].Name,
							type : renderType,
							location : groupData[j].Location,
							path : groupData[j].Path,
							commitURI : groupData[j].Git.CommitLocation,
							indexURI : groupData[j].Git.IndexLocation,
							DiffLocation : groupData[j].Git.DiffLocation,
							CloneLocation : this._model.items.CloneLocation,
							conflicting : isConflict(renderType)
						});
					}
				}
			}
			retValue.sort(function(a, b) {
				var n1 = a.name && a.name.toLowerCase();
				var n2 = b.name && b.name.toLowerCase();
				if (n1 < n2) {
					return -1;
				}
				if (n1 > n2) {
					return 1;
				}
				return 0;
			});
			return retValue;
		};

		// Git unstaged changes

		GitStatusExplorer.prototype.displayUnstaged = function(status, repository) {
			var that = this;
			var unstagedSortedChanges = this._sortBlock(this._model.interestedUnstagedGroup);
			var tableNode = lib.node('table'); //$NON-NLS-0$
			var unstagedSection = new mSection.Section(tableNode, {
				id : "unstagedSection", //$NON-NLS-0$
				title : unstagedSortedChanges.length > 0 ? messages['Unstaged'] : messages["No Unstaged Changes"],
				content : '<div id="unstagedNode"></div>', //$NON-NLS-0$
				canHide : true,
				onExpandCollapse : function(isExpanded, section) {
					that.commandService.destroy(section.selectionNode);
					if (isExpanded) {
						that.commandService.renderCommands(section.selectionNode.id, section.selectionNode, null, that, "button", {"Clone" : repository}); //$NON-NLS-1$ //$NON-NLS-0$
					}
				}
			});

			if (this.unstagedNavigator) {
				this.unstagedNavigator.destroy(); 
			}
			this.unstagedNavigator = new mGitChangeList.GitChangeListExplorer({
				serviceRegistry: this.registry,
				commandRegistry: this.commandService,
				selection: this.unstagedSelection,
				parentId:"unstagedNode", //hack
				changesModel: this._model,
				prefix: "unstaged",
				changes: unstagedSortedChanges,
				status: status,
				section: unstagedSection,
				repository: repository
			});
			this.unstagedNavigator.display();
		};

		// Git staged changes 

		GitStatusExplorer.prototype.displayStaged = function(status, repository) {
			var that = this;
			var stagedSortedChanges = this._sortBlock(this._model.interestedStagedGroup);
			var tableNode = lib.node('table'); //$NON-NLS-0$
			var stagedSection = new mSection.Section(tableNode, {
				id : "stagedSection", //$NON-NLS-0$
				title : stagedSortedChanges.length > 0 ? messages['Staged'] : messages["No Staged Changes"],
				content : '<div id="stagedNode"></div>', //$NON-NLS-0$
				slideout : true,
				canHide : true,
				onExpandCollapse : function(isExpanded, section) {
					that.commandService.destroy(section.selectionNode);
					if (isExpanded) {
						that.commandService.renderCommands(section.selectionNode.id, section.selectionNode, null, that, "button", { "Clone" : repository}); //$NON-NLS-0$ //$NON-NLS-1$
					}
				}
			});
			
			if (this.stagedNavigator) {
				this.stagedNavigator.destroy(); 
			}
			this.stagedNavigator = new mGitChangeList.GitChangeListExplorer({
				serviceRegistry: this.registry,
				commandRegistry: this.commandService,
				selection: this.stagedSelection,
				parentId:"stagedNode", //hack
				changesModel: this._model,
				prefix: "staged",
				changes: stagedSortedChanges,
				status: status,
				section: stagedSection,
				repository: repository
			});
			this.stagedNavigator.display();
		};

		// Git commits

		GitStatusExplorer.prototype.displayCommits = function(repository) {
			var tableNode = lib.node('table'); //$NON-NLS-0$
			var titleWrapper = new mSection.Section(tableNode, {
				id : "commitSection", //$NON-NLS-0$
				title : messages['Commits'],
				content : '<div id="commitNode" class="mainPadding"></div>', //$NON-NLS-0$
				slideout : true,
				canHide : true,
				preferenceService : this.registry.getService("orion.core.preference") //$NON-NLS-0$
			});
			var explorer = new mGitCommitList.GitCommitListExplorer({
				serviceRegistry: this.registry,
				commandRegistry: this.commandService,
				selection: this.selection,
				actionScopeId: this.actionScopeId,
				parentId:"commitNode", //hack
			});
			explorer.displayCommits(repository, titleWrapper, this.handleError.bind(this));
		};
		
		return GitStatusExplorer;
	}());

	return exports;
}); // end of define