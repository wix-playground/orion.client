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
	'orion/Deferred',
	'orion/section',
	'orion/URITemplate',
	'orion/PageUtil',
	'orion/webui/littlelib',
	'orion/globalCommands',
	'orion/git/gitCommands'
], function(require, messages, mGitCommitList, mGitChangeList, Deferred, mSection, URITemplate, PageUtil, lib, mGlobalCommands, mGitCommands) {

	var exports = {};

	var repoTemplate = new URITemplate("git/git-repository.html#{,resource,params*}"); //$NON-NLS-0$

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
			var tableNode = lib.node('table'); //$NON-NLS-0$
			lib.empty(tableNode);
			var changesModel = new mGitChangeList.GitChangeListModel({registry: this.registry});
			var that = this;
			Deferred.all([
				this.displayUnstaged(location, changesModel),
				this.displayStaged(location, changesModel),
				//this.displayCommits()
			]).then(function() {
				that.initTitleBar(changesModel, changesModel.repository);
				mGitCommands.updateNavTools(that.registry, that.commandService, that, "pageActions", "selectionTools", changesModel.status); //$NON-NLS-1$ //$NON-NLS-0$
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

		
		// Git unstaged changes

		GitStatusExplorer.prototype.displayUnstaged = function(location, changesModel) {
			var that = this;
			//var unstagedSortedChanges = this._sortBlock(this._model.interestedUnstagedGroup);
			var tableNode = lib.node('table'); //$NON-NLS-0$
			var unstagedSection = new mSection.Section(tableNode, {
				id : "unstagedSection", //$NON-NLS-0$
				title : messages['Unstaged'], //unstagedSortedChanges.length > 0 ? messages['Unstaged'] : messages["No Unstaged Changes"],
				content : '<div id="unstagedNode"></div>', //$NON-NLS-0$
				canHide : true,
				onExpandCollapse : function(isExpanded, section) {
//					that.commandService.destroy(section.selectionNode);
//					if (isExpanded) {
//						that.commandService.renderCommands(section.selectionNode.id, section.selectionNode, null, that.unstagedNavigator, "button", {"Clone" : that.unstagedNavigator.changesModel.repository}); //$NON-NLS-1$ //$NON-NLS-0$
//					}
				}
			});

			if (this.unstagedNavigator) {
				this.unstagedNavigator.destroy(); 
			}
			this.unstagedNavigator = new mGitChangeList.GitChangeListExplorer({
				serviceRegistry: this.registry,
				commandRegistry: this.commandService,
				selection: this.unstagedSelection,
				parentId:"unstagedNode", 
				prefix: "unstaged",
				changesModel: changesModel,
				location: location,
				section: unstagedSection
			});
			return this.unstagedNavigator.display();
		};

		// Git staged changes 

		GitStatusExplorer.prototype.displayStaged = function(location, changesModel) {
			var that = this;
			//var stagedSortedChanges = this._sortBlock(this._model.interestedStagedGroup);
			var tableNode = lib.node('table'); //$NON-NLS-0$
			var stagedSection = new mSection.Section(tableNode, {
				id : "stagedSection", //$NON-NLS-0$
				title : messages['Staged'], //stagedSortedChanges.length > 0 ? messages['Staged'] : messages["No Staged Changes"],
				content : '<div id="stagedNode"></div>', //$NON-NLS-0$
				slideout : true,
				canHide : true,
				onExpandCollapse : function(isExpanded, section) {
//					that.commandService.destroy(section.selectionNode);
//					if (isExpanded) {
//						that.commandService.renderCommands(section.selectionNode.id, section.selectionNode, null, that.stagedNavigator, "button", { "Clone" : that.stagedNavigator.changesModel.repository}); //$NON-NLS-0$ //$NON-NLS-1$
//					}
				}
			});
			
			if (this.stagedNavigator) {
				this.stagedNavigator.destroy(); 
			}
			this.stagedNavigator = new mGitChangeList.GitChangeListExplorer({
				serviceRegistry: this.registry,
				commandRegistry: this.commandService,
				selection: this.stagedSelection,
				parentId:"stagedNode", 
				prefix: "staged",
				changesModel: changesModel,
				location: location,
				section: stagedSection
			});
			return this.stagedNavigator.display();
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
				parentId:"commitNode", 
			});
			explorer.displayCommits(repository, titleWrapper, this.handleError.bind(this));
			//TODO
			return new Deferred().resolve();
		};
		
		return GitStatusExplorer;
	}());

	return exports;
}); // end of define