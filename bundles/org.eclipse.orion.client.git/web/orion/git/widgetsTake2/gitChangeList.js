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
	'orion/i18nUtil',
	'orion/PageUtil',
	'orion/explorers/navigationUtils',
	*/
	'orion/explorers/explorer',
	'orion/git/uiUtil',
	'orion/webui/tooltip',
	'orion/objects'
], function(mExplorer, mGitUIUtil, mTooltip, objects/*require, messages, Deferred, mExplorer, URITemplate, util, i18nUtil, PageUtil, mNavUtils, objects*/) {
		
	function GitChangeListModel(changes, prefix) {
		this.changes = changes;
		this.prefix = prefix;
	}
	GitChangeListModel.prototype = Object.create(mExplorer.Explorer.prototype);
	objects.mixin(GitChangeListModel.prototype, /** @lends orion.git.GitChangeListModel.prototype */ {
		destroy: function(){
		},
		getRoot: function(onItem){
			onItem(this.changes);
		},
		getChildren: function(parentItem, onComplete){	
			if (parentItem instanceof Array && parentItem.length > 0) {
				onComplete(parentItem);
			} else if (mGitUIUtil.isChange(parentItem) || parentItem.Type === "Diff") {
			// lazy creation, this is required for selection  model to be able to traverse into children
				if (!parentItem.children) {
					parentItem.children = [];
					parentItem.children.push({ DiffLocation : parentItem.DiffLocation, Type : "Compare", parent : parentItem});//$NON-NLS-0$
				}
				onComplete(parentItem.children);
			} else {
				onComplete([]);
			}
		},
		getId: function(/* item */ item){
			if (item instanceof Array && item.length > 0) {
				return this.prefix + "Root"; //$NON-NLS-0$
			} else if (mGitUIUtil.isChange(item)) {
				return  this.prefix + item.name; 
			} else {
				return  this.prefix + item.DiffLocation;
			}
		}
	});
	
	/**
	 * @class orion.git.GitChangeListExplorer
	 * @extends orion.explorers.Explorer
	 */
	function GitChangeListExplorer(options) {
		var renderer = new GitChangeListRenderer({registry: options.serviceRegistry, commandService: options.commandRegistry, actionScopeId: options.actionScopeId, cachePrefix: options.prefix + "Navigator", checkbox: false}, this); //$NON-NLS-0$
		mExplorer.Explorer.call(this, options.serviceRegistry, options.selection, renderer, options.commandRegistry);	
		this.checkbox = false;
		this.parentId = options.parentId;
		this.actionScopeId = options.actionScopeId;
		this.changesModel = options.changesModel;
		this.prefix = options.prefix;
		this.changes = options.changes;
		this.status = options.status;
	}
	GitChangeListExplorer.prototype = Object.create(mExplorer.Explorer.prototype);
	objects.mixin(GitChangeListExplorer.prototype, /** @lends orion.git.GitChangeListExplorer.prototype */ {
		display: function() {
			this.createTree(this.parentId, new GitChangeListModel(this.changes, this.prefix));
		},
		isRowSelectable: function(modelItem) {
			return mGitUIUtil.isChange(modelItem);
		},
		getItemCount: function() {
			return this.changes.length;
		}
	});
	
	function GitChangeListRenderer(options, explorer) {
		mExplorer.SelectionRenderer.apply(this, arguments);
		this.registry = options.registry;
	}
	GitChangeListRenderer.prototype = Object.create(mExplorer.SelectionRenderer.prototype);
	objects.mixin(GitChangeListRenderer.prototype, {
		getCellElement: function(col_no, item, tableRow){
			var div, td, navGridHolder;
			var explorer = this.explorer;
			switch (col_no) {
				case 0:
					if (mGitUIUtil.isChange(item) || item.Type === "Diff") {
						td = document.createElement("td"); //$NON-NLS-0$
						div = document.createElement("div"); //$NON-NLS-0$
						div.className = "sectionTableItem"; //$NON-NLS-0$
						td.appendChild(div);
	
						this.getExpandImage(tableRow, div);
	
						navGridHolder = explorer.getNavDict() ? explorer.getNavDict().getGridNavHolder(item, true) : null;
						var diffActionWrapper = document.createElement("span"); //$NON-NLS-0$
						diffActionWrapper.id = explorer.prefix + item.name + "DiffActionWrapper"; //$NON-NLS-0$
						diffActionWrapper.className = "sectionExplorerActions"; //$NON-NLS-0$
						div.appendChild(diffActionWrapper);
				
						explorer.commandService.destroy(diffActionWrapper);
						explorer.commandService.renderCommands(
							"DefaultActionWrapper", diffActionWrapper, item, explorer, "tool", null, navGridHolder); //$NON-NLS-1$ //$NON-NLS-0$
				
						var icon = document.createElement("span"); //$NON-NLS-0$
						icon.className = explorer.changesModel.getClass(item);
						icon.commandTooltip = new mTooltip.Tooltip({
							node: icon,
							text: explorer.changesModel.getTooltip(item),
							position: ["above", "below", "right", "left"] //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-1$ //$NON-NLS-0$
						});
						div.appendChild(icon);
	
						var itemLabel = document.createElement("span"); //$NON-NLS-0$
						itemLabel.textContent = item.name;
						div.appendChild(itemLabel);
	
						return td;
					} else {
						// render the compare widget
						td = document.createElement("td"); //$NON-NLS-0$
						td.colSpan = 2;
	
						div = document.createElement("div"); //$NON-NLS-0$
						div.className = "sectionTableItem"; //$NON-NLS-0$
						td.appendChild(div);
	
						var actionsWrapper = document.createElement("div"); //$NON-NLS-0$
						actionsWrapper.className = "sectionExplorerActions"; //$NON-NLS-0$
						div.appendChild(actionsWrapper);

						var diffActionWrapper = document.createElement("span"); //$NON-NLS-0$
						diffActionWrapper.id = explorer.prefix + item.parent.name + "DiffActionWrapperChange"; //$NON-NLS-0$
						actionsWrapper.appendChild(diffActionWrapper);

						var compareWidgetActionWrapper = document.createElement("span"); //$NON-NLS-0$
						compareWidgetActionWrapper.id = explorer.prefix + item.parent.name + "CompareWidgetActionWrapper"; //$NON-NLS-0$
						actionsWrapper.appendChild(compareWidgetActionWrapper);
	
						var diffContainer = document.createElement("div"); //$NON-NLS-0$
						diffContainer.id = "diffArea_" + item.DiffLocation; //$NON-NLS-0$
						diffContainer.style.height = "420px"; //$NON-NLS-0$
						diffContainer.style.border = "1px solid lightgray"; //$NON-NLS-0$
						diffContainer.style.overflow = "hidden"; //$NON-NLS-0$
						div.appendChild(diffContainer);
	
						navGridHolder = this.explorer.getNavDict() ? this.explorer.getNavDict().getGridNavHolder(item, true) : null;
						var hasConflict = item.parent.type === "Conflicting";
						mGitUIUtil.createCompareWidget(
							explorer.registry,
							explorer.commandService,
							item.DiffLocation,
							hasConflict,
							diffContainer,
							compareWidgetActionWrapper.id,
							false, //editableInComparePage
							{
								navGridHolder : navGridHolder,
								additionalCmdRender : function(gridHolder) {
									explorer.commandService.destroy(diffActionWrapper.id);
									explorer.commandService.renderCommands(
										"itemLevelCommands", diffActionWrapper.id, item.parent, explorer, "tool", false, gridHolder); //$NON-NLS-0$
								},
								before : true
							}
						);
						return td;
					}
					break;
			}
		}
	});
	
	return {
		GitChangeListExplorer: GitChangeListExplorer,
		GitChangeListRenderer: GitChangeListRenderer
	};

});