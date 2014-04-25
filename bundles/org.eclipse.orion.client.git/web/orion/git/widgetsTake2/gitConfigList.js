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
/*
	'require',
	'i18n!git/nls/gitmessages',
	'orion/Deferred',
	'orion/URITemplate',
	'orion/git/util',
	'orion/PageUtil',
	'orion/explorers/navigationUtils',
	*/
	'i18n!git/nls/gitmessages',
	'orion/explorers/explorer',
	'orion/git/uiUtil',
	'orion/webui/tooltip',
	'orion/i18nUtil',
	'orion/objects'
], function(messages, mExplorer, mGitUIUtil, mTooltip, i18nUtil, objects/*require, messages, Deferred, mExplorer, URITemplate, util, i18nUtil, PageUtil, mNavUtils, objects*/) {
		
	function GitConfigListModel(options) {
		this.root = options.root;
		this.registry = options.registry;
		this.handleError = options.handleError;
		this.titleWrapper = options.titleWrapper;
	}
	GitConfigListModel.prototype = Object.create(mExplorer.Explorer.prototype);
	objects.mixin(GitConfigListModel.prototype, /** @lends orion.git.GitConfigListModel.prototype */ {
		destroy: function(){
		},
		getRoot: function(onItem){
			onItem(this.root);
		},
		getChildren: function(parentItem, onComplete){	
			var that = this;
			var progress;
			if (parentItem.Type === "ConfigRoot") {
				progress = this.titleWrapper.createProgressMonitor();
				progress.begin(messages["Getting confituration"]);
				this.registry.getService("orion.page.progress").progress(this.registry.getService("orion.git.provider").getGitCloneConfig(parentItem.repository.ConfigLocation), "Getting configuration of " + parentItem.repository.Name).then( function(resp){  //$NON-NLS-0$
					progress.worked("Rendering configuration"); //$NON-NLS-0$
					var configurationEntries = resp.Children;
					
					if (configurationEntries.length === 0){
						that.titleWrapper.setTitle("No Configuration"); //$NON-NLS-0$
					}
					
					var filteredConfig = [];
					for(var i=0; i<configurationEntries.length ;i++){
						if (parentItem.mode === "full" || configurationEntries[i].Key.indexOf("user.") !== -1) //$NON-NLS-1$ //$NON-NLS-0$
							filteredConfig.push(configurationEntries[i]);
					}
					progress.done();
					onComplete(filteredConfig);
				}, function(error){
					progress.done();
					that.handleError(error);
				});
			} else {
				onComplete([]);
			}
		},
		getId: function(/* item */ item){
			if (item.Type === "BranchRoot") {
				return "BranchRoot"; //$NON-NLS-0$
			} else {
				return item.Name;
			}
		}
	});
	
	/**
	 * @class orion.git.GitConfigListExplorer
	 * @extends orion.explorers.Explorer
	 */
	function GitConfigListExplorer(options) {
		var renderer = new GitConfigListRenderer({registry: options.serviceRegistry, commandService: options.commandRegistry, actionScopeId: options.actionScopeId, cachePrefix: options.prefix + "Navigator", checkbox: false}, this); //$NON-NLS-0$
		mExplorer.Explorer.call(this, options.serviceRegistry, options.selection, renderer, options.commandRegistry);	
		this.checkbox = false;
		this.parentId = options.parentId;
		this.actionScopeId = options.actionScopeId;
		this.root = options.root;
		this.titleWrapper = options.titleWrapper;
		this.handleError = options.handleError;
	}
	GitConfigListExplorer.prototype = Object.create(mExplorer.Explorer.prototype);
	objects.mixin(GitConfigListExplorer.prototype, /** @lends orion.git.GitConfigListExplorer.prototype */ {
		display: function() {
			this.createTree(this.parentId, new GitConfigListModel({root: this.root, registry: this.registry, titleWrapper: this.titleWrapper, handleError: this.handleError}));
		},
		isRowSelectable: function(modelItem) {
			return false;
		}
//		,
//		getItemCount: function() {
//			return this.changes.length;
//		}
	});
	
	function GitConfigListRenderer(options, explorer) {
		mExplorer.SelectionRenderer.apply(this, arguments);
		this.registry = options.registry;
	}
	GitConfigListRenderer.prototype = Object.create(mExplorer.SelectionRenderer.prototype);
	objects.mixin(GitConfigListRenderer.prototype, {
		getCellElement: function(col_no, item, tableRow){
			var div, td;
			switch (col_no) {
				case 0:
					td = document.createElement("td"); //$NON-NLS-0$
					div = document.createElement("div"); //$NON-NLS-0$
					div.className = "sectionTableItem lightTreeTableRow"; //$NON-NLS-0$
					td.appendChild(div);
			
					var horizontalBox = document.createElement("div");
					horizontalBox.style.overflow = "hidden";
					div.appendChild(horizontalBox);
					
					var detailsView = document.createElement("div");
					detailsView.className = "stretch";
					horizontalBox.appendChild(detailsView);
			
					var keySpan = document.createElement("span");
					keySpan.textContent = item.Key;
					detailsView.appendChild(keySpan);
					
					var valueSpan = document.createElement("span");
					valueSpan.style.paddingLeft = "10px";
					valueSpan.textContent = item.Value;
					detailsView.appendChild(valueSpan);
					
					var actionsArea = document.createElement("div");
					actionsArea.className = "sectionTableItemActions";
					actionsArea.id = "configActionsArea";
					horizontalBox.appendChild(actionsArea);
			
					this.commandService.renderCommands(this.actionScopeId, actionsArea, item, this, "tool"); //$NON-NLS-0$
					return td;
			}
		}
	});
	
	return {
		GitConfigListExplorer: GitConfigListExplorer,
		GitConfigListRenderer: GitConfigListRenderer
	};

});