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
	'orion/explorers/explorer',
	'orion/URITemplate',
	'orion/git/util',
	'orion/explorers/navigationUtils',
	'orion/git/widgets/CommitTooltipDialog',
	'orion/objects'
], function(require, messages, mExplorer, URITemplate, util, mNavUtils, mCommitTooltip, objects) {
	var commitTemplate = new URITemplate("git/git-commit.html#{,resource,params*}?page=1&pageSize=1"); //$NON-NLS-0$

	function GitCommitListModel(commits) {
		this.commits = commits;
	}
	GitCommitListModel.prototype = Object.create(mExplorer.Explorer.prototype);
	objects.mixin(GitCommitListModel.prototype, /** @lends orion.git.GitCommitListModel.prototype */ {
		destroy: function(){
		},
		getRoot: function(onItem){
			onItem(this.commits);
		},
		getChildren: function(parentItem, onComplete){	
			if (parentItem instanceof Array && parentItem.length > 0) {
				onComplete(parentItem);
			} else {
				onComplete([]);
			}
		},
		getId: function(/* item */ item){
			return item.Name;
		}
	});
	
	/**
	 * @class orion.git.GitCommitListExplorer
	 * @extends orion.explorers.Explorer
	 */
	function GitCommitListExplorer(options) {
		var renderer = new GitCommitListRenderer({registry: options.serviceRegistry, commandService: options.commandRegistry, actionScopeId: options.actionScopeId, cachePrefix: "LogNavigator", checkbox: false, incomingCommits: options.incomingCommits, outgoingCommits: options.outgoingCommits}, this); //$NON-NLS-0$
		mExplorer.Explorer.call(this, options.serviceRegistry, options.selection, renderer, options.commandRegistry);	
		this.checkbox = false;
		this.parentId = options.parentId;
		this.actionScopeId = options.actionScopeId;
		this.createTree(this.parentId, new GitCommitListModel(options.commits));
	}
	GitCommitListExplorer.prototype = Object.create(mExplorer.Explorer.prototype);
	objects.mixin(GitCommitListExplorer.prototype, /** @lends orion.git.GitCommitListExplorer.prototype */ {
	
	});
	
	function GitCommitListRenderer(options, explorer) {
		this.incomingCommits = options.incomingCommits;
		this.outgoingCommits = options.outgoingCommits;
		mExplorer.SelectionRenderer.apply(this, arguments);
	}
	GitCommitListRenderer.prototype = Object.create(mExplorer.SelectionRenderer.prototype);
	objects.mixin(GitCommitListRenderer.prototype, {
		getCellElement: function(col_no, item, tableRow){
			var commit = item;
			
			switch(col_no){
			case 0:	
				var td = document.createElement("td"); //$NON-NLS-0$

				var sectionItem = document.createElement("div");
				sectionItem.className = "sectionTableItem";
				td.appendChild(sectionItem);

				var horizontalBox = document.createElement("div");
				horizontalBox.style.overflow = "hidden";
				sectionItem.appendChild(horizontalBox);
				
				var incomingCommit = false;
				for(var i=0; i<this.incomingCommits.length; i++){
					var comm = this.incomingCommits[i];
					
					if (commit.Name === comm.Name){
						incomingCommit = true;
					}
				}
					
				var outgoingCommit = false;
				for(var i=0; i<this.outgoingCommits.length; i++){
					var comm = this.outgoingCommits[i];
					
					if (commit.Name === comm.Name){
						outgoingCommit = true;
					}
				}
				
				if(!incomingCommit && !outgoingCommit){
					var direction = document.createElement("span");
					horizontalBox.appendChild(direction);
				} else {
					var imgSpriteName = (outgoingCommit ? "git-sprite-outgoing-commit" : "git-sprite-incoming-commit");
					var direction = document.createElement("span");
					direction.className = "sectionIcon gitImageSprite " + imgSpriteName;
					horizontalBox.appendChild(direction);
				}
				
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

				var description = document.createElement("span");
				description.textContent = messages[" (SHA "] + commit.Name + messages[") by "] + commit.AuthorName + messages[" on "]
						+ new Date(commit.Time).toLocaleString();
				detailsView.appendChild(description);

				return td;
				
				break;
			case 1:
				var actionsColumn = this.getActionsColumn(item, tableRow, null, null, true);
				return actionsColumn;
				break;
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
//		function() {
//			var sectionItem = document.createElement("div");
//			sectionItem.className = "sectionTableItem";
//			container.appendChild(sectionItem);
//	
//			var horizontalBox = document.createElement("div");
//			horizontalBox.style.overflow = "hidden";
//			sectionItem.appendChild(horizontalBox);
//			
//			var detailsView = document.createElement("div");
//			detailsView.className = "stretch";
//			horizontalBox.appendChild(detailsView);
//	
//			var title = document.createElement("div");
//			title.textContent = messages["The branch is up to date."];
//			detailsView.appendChild(title);
//			
//			var description = document.createElement("div");
//			description.textContent = messages["You have no outgoing or incoming commits."];
//			detailsView.appendChild(description);
//		}
	});
	
	return {
		GitCommitListExplorer: GitCommitListExplorer,
		GitCommitListRenderer: GitCommitListRenderer
	};

});