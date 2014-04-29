/*******************************************************************************
 * @license Copyright (c) 2011, 2013 IBM Corporation and others. All rights
 *          reserved. This program and the accompanying materials are made
 *          available under the terms of the Eclipse Public License v1.0
 *          (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse
 *          Distribution License v1.0
 *          (http://www.eclipse.org/org/documents/edl-v10.html).
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global define window console document Image */

define([
	'require',
	'i18n!git/nls/gitmessages',
	'orion/section',
	'orion/git/widgetsTake2/gitChangeList',
	'orion/git/widgetsTake2/gitTagList',
	'orion/explorers/explorer',
	'orion/URITemplate',
	'orion/PageUtil',
	'orion/i18nUtil',
	'orion/webui/littlelib',
	'orion/globalCommands',
	'orion/git/gitCommands',
	'orion/git/uiUtil',
	'orion/Deferred',
	'orion/webui/tooltip'
], function(require, messages, mSection, mGitChangeList, mGitTagList, mExplorer, URITemplate, PageUtil, i18nUtil, lib, mGlobalCommands, mGitCommands, mGitUIUtil, Deferred, Tooltip) {
			var exports = {};
			
			var repoTemplate = new URITemplate("git/git-repository.html#{,resource,params*}"); //$NON-NLS-0$
			var commitTemplate = new URITemplate("git/git-commit.html#{,resource,params*}?page=1&pageSize=1"); //$NON-NLS-0$

			exports.GitCommitExplorer = (function() {

				/**
				 * Creates a new Git commit explorer.
				 * 
				 * @class Git commit explorer
				 * @name orion.git.GitCommitExplorer
				 * @param registry
				 * @param commandService
				 * @param linkService
				 * @param selection
				 * @param parentId
				 * @param toolbarId
				 * @param sectionToolsId
				 * @param actionScopeId
				 */
				function GitCommitExplorer(registry, commandService, linkService, selection, parentId, toolbarId, selectionToolsId, actionScopeId) {
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

				GitCommitExplorer.prototype.handleError = function(error) {
					var display = {};
					display.Severity = "Error"; //$NON-NLS-0$
					display.HTML = false;
					try {
						var resp = JSON.parse(error.responseText);
						display.Message = resp.DetailedMessage ? resp.DetailedMessage : resp.Message;
					} catch (Exception) {
						display.Message = error.message;
					}
					this.registry.getService("orion.page.message").setProgressResult(display); //$NON-NLS-0$

					if (error.status === 404) {
						this.initTitleBar();
						this.displayCommit();
					}
				};

				GitCommitExplorer.prototype.changedItem = function(parent, children) {
					this.redisplay();
				};

				GitCommitExplorer.prototype.redisplay = function() {
					var pageParams = PageUtil.matchResourceParameters();
					this.display(pageParams.resource);
				};

				GitCommitExplorer.prototype.display = function(location) {
					var that = this;
					var progressService = this.registry.getService("orion.page.progress"); //$NON-NLS-0$

					progressService
							.showWhile(this.registry.getService("orion.git.provider").getGitClone(location), "Getting repository details").then( //$NON-NLS-0$
									function(resp) {
										if (resp.Children.length === 0) {
											that.initTitleBar();
											that.displayCommit();
										} else if (resp.Children.length === 1 && resp.Children[0].Type === "Commit") { //$NON-NLS-0$
											var commits = resp.Children;

											progressService
													.progress(
															that.registry.getService("orion.git.provider").getGitClone(resp.CloneLocation), "Getting repository details " + resp.Name).then( //$NON-NLS-0$
													function(resp) {
														var repositories = resp.Children;
														that.initTitleBar(commits[0], repositories[0]);
														that.displayCommit(commits[0]);
														that.displayTags(commits[0], repositories[0]);
														that.displayDiffs(commits[0]);

														commits[0].CloneLocation = repositories[0].Location;

														// render commands
														mGitCommands.updateNavTools(that.registry, that.commandService, that, "pageActions", "selectionTools", commits[0]); //$NON-NLS-1$ //$NON-NLS-0$
													}, function(error) {
														that.handleError(error);
													});
										}
									}, function(error) {
										that.handleError(error);
									});
				};

				GitCommitExplorer.prototype.initTitleBar = function(commit, repository) {
					var that = this;
					var item = {};

					commit.GitUrl = repository.GitUrl;
					commit.ContentLocation = repository.ContentLocation;

					if (commit) {
						item = {};
						item.Name = commit.Name;
						item.Parents = [];
						item.Parents[0] = {};
						item.Parents[0].Name = repository.Name;
						item.Parents[0].Location = repository.Location;
						item.Parents[0].ChildrenLocation = repository.Location;
						item.Parents[1] = {};
						item.Parents[1].Name = messages["Repositories"];
					}
					mGlobalCommands.setPageTarget({ task : "Commit",
					target : commit,
					breadcrumbTarget : item,
					makeBreadcrumbLink : function(seg, location) {
						seg.href = require.toUrl(repoTemplate.expand({resource: location || ""}));
					},
					serviceRegistry : that.registry,
					commandService : that.commandService
					});
				};

				GitCommitExplorer.prototype.displayCommit = function(commit) {

					var tableNode = lib.node('table'); //$NON-NLS-0$
					lib.empty(tableNode);

					if (!commit) {
						var titleWrapper = new mSection.Section(tableNode, { id : "commitSection", //$NON-NLS-0$
						title : messages["No Commits"],
						iconClass : "core-sprite-file" //$NON-NLS-0$
						});
						return;
					}

					var contentParent = document.createElement("div");
					contentParent.className = "sectionTable";
					tableNode.appendChild(contentParent);

					var commitNode = document.createElement("div");
					commitNode.className = "mainPadding";
					commitNode.id = "commitNode";
					contentParent.appendChild(commitNode);

					var detailsView = document.createElement("div");
					detailsView.className = "sectionTableItem";
					commitNode.appendChild(detailsView);

					var commitMessages = this._splitCommitMessage(commit.Message);

					var mainCommitMessage = document.createElement("div");
					mainCommitMessage.style.paddingBottom = "15px";
					this.registry.getService("orion.core.textlink").addLinks(commitMessages[0], mainCommitMessage); //$NON-NLS-0$
					detailsView.appendChild(mainCommitMessage);

					if (commitMessages[1] !== null) {
						var secondaryCommitMessage = document.createElement("pre");
						secondaryCommitMessage.style.paddingBottom = "15px";
						secondaryCommitMessage.style.marginTop = "0px";
						this.registry.getService("orion.core.textlink").addLinks(commitMessages[1], secondaryCommitMessage); //$NON-NLS-0$
						detailsView.appendChild(secondaryCommitMessage);
					}

					var commitName = document.createElement("div");
					commitName.appendChild(document.createTextNode(i18nUtil.formatMessage(messages["commit: 0"], commit.Name)));
					detailsView.appendChild(commitName);

					if (commit.Parents && commit.Parents.length > 0) {
						var parentCommitName = document.createElement("div");
						parentCommitName.style.paddingBottom = "15px";
						var parentCommitLink = document.createElement("a");
						parentCommitLink.className = "pnavlinkonpage";
						parentCommitLink.href = require.toUrl(commitTemplate.expand({resource: commit.Parents[0].Location})); //$NON-NLS-1$ //$NON-NLS-0$
						parentCommitLink.textContent = i18nUtil.formatMessage(messages["parent: 0"], commit.Parents[0].Name);
						parentCommitName.appendChild(parentCommitLink);
						detailsView.appendChild(parentCommitName);
					}

					if (commit.AuthorImage) {
						var authorImage = document.createElement("div");
						authorImage.style['float'] = "left";
						var image = new Image();
						image.src = commit.AuthorImage;
						image.name = commit.AuthorName;
						image.className = "git-author-icon-small";
						authorImage.appendChild(image);
						detailsView.appendChild(authorImage);
					}

					var author = document.createElement("div");

					var authorName = document.createElement("div");
					authorName.appendChild(document.createTextNode(i18nUtil.formatMessage(messages["authored by 0 (1) on 2"], commit.AuthorName,
							commit.AuthorEmail, new Date(commit.Time).toLocaleString())));
					author.appendChild(authorName);

					var committerName = document.createElement("div");
					committerName.appendChild(document.createTextNode(i18nUtil.formatMessage(messages["committed by 0 (1)"], commit.CommitterName,
							commit.CommitterEmail)));
					author.appendChild(committerName);

					detailsView.appendChild(author);
				};

				GitCommitExplorer.prototype._splitCommitMessage = function(commitMessage) {
					var cut = false;
					var mainMessageMaxLength = 100;

					var commitMessage0 = commitMessage.split(/(\r?\n|$)/)[0].trim();
					if (commitMessage0.length > mainMessageMaxLength) {
						var cutPoint = commitMessage0.indexOf(" ", mainMessageMaxLength - 10); //$NON-NLS-0$
						commitMessage0 = commitMessage0.substring(0, (cutPoint !== -1 ? cutPoint : mainMessageMaxLength));
						cut = true;
					}
					;

					var commitMessage1 = commitMessage.substring(commitMessage0.length + 1, commitMessage.length).trim();
					if (commitMessage1.length > 0) {
						commitMessage1 = (cut ? "..." + commitMessage1 : commitMessage1); //$NON-NLS-0$
					} else {
						commitMessage1 = null;
					}

					commitMessage0 += (cut ? "..." : ""); //$NON-NLS-0$

					return [ commitMessage0, commitMessage1 ];
				};

				// Git tags

				GitCommitExplorer.prototype.displayTags = function(commit, repository) {
					var tags = commit.Tags;

					var tableNode = lib.node('table'); //$NON-NLS-0$

					var titleWrapper = new mSection.Section(tableNode, { id : "tagSection", //$NON-NLS-0$
						title : ((tags && tags.length > 0) ? messages["Tags:"] : messages["No Tags"]),
						iconClass : [ "gitImageSprite", "git-sprite-tag" ], //$NON-NLS-1$ //$NON-NLS-0$
						slideout : true,
						content : '<div id="tagNode"></div>', //$NON-NLS-0$
						canHide : true,
						preferenceService : this.registry.getService("orion.core.preference") //$NON-NLS-0$
					});

					var tagsNavigator = new mGitTagList.GitTagListExplorer({
						serviceRegistry: this.registry,
						commandRegistry: this.commandService,
						parentId:"tagNode",
						actionScopeId: this.actionScopeId,
						titleWrapper: titleWrapper,
						repository: repository,
						mode: "full",
						commit: commit
					});
					tagsNavigator.display();
				};


				// Git diffs

				GitCommitExplorer.prototype.displayDiffs = function(commit) {

					var diffs = commit.Diffs;

					var changesModel = {
						getClass: function (item) {
							var sprite = "git-sprite-file"; //$NON-NLS-0$
							if (item.ChangeType === "ADD") { //$NON-NLS-0$
								sprite = "git-sprite-addition"; //$NON-NLS-0$
							} else if (item.ChangeType === "DELETE") { //$NON-NLS-0$
								sprite = "git-sprite-removal"; //$NON-NLS-0$
							}
							return sprite;
						},
						getTooltip: function(item) {
							var tooltip = messages["Diffs"]; //$NON-NLS-0$
							if (item.ChangeType === "ADD") { //$NON-NLS-0$
								tooltip =  messages["Addition"]; //$NON-NLS-0$
							} else if (item.ChangeType === "DELETE") { //$NON-NLS-0$
								tooltip = messages["Deletion"]; //$NON-NLS-0$
							}
							return tooltip;
						}
					};

					diffs.forEach(function(item) {
						var path = item.OldPath;
						if (item.ChangeType === "ADD") { //$NON-NLS-0$
							path = item.NewPath;
						} 
						item.name = path;
					});
					var tableNode = lib.node('table'); //$NON-NLS-0$

					var section = new mSection.Section(tableNode, { id : "diffSection", //$NON-NLS-0$
					title : messages["Diffs"],
					content : '<div id="diffNode"></div>', //$NON-NLS-0$
					canHide : true,
					preferenceService : this.registry.getService("orion.core.preference") //$NON-NLS-0$
					});

					this.commandService.registerCommandContribution(section.actionsNode.id, "orion.explorer.expandAll", 100); //$NON-NLS-1$ //$NON-NLS-0$
					this.commandService.registerCommandContribution(section.actionsNode.id, "orion.explorer.collapseAll", 200); //$NON-NLS-1$ //$NON-NLS-0$

					var sectionItemActionScopeId = "diffSectionItemActionArea"; //$NON-NLS-0$


					var diffNavigator = new mGitChangeList.GitChangeListExplorer({
						serviceRegistry: this.registry,
						commandRegistry: this.commandService,
						selection: null,
						parentId:"diffNode",
						actionScopeId: sectionItemActionScopeId,
						changesModel: changesModel,
						prefix: "diff",
						changes: diffs
					});
					diffNavigator.display();
					this.commandService.renderCommands(section.actionsNode.id, section.actionsNode.id, diffNavigator, diffNavigator, "button"); //$NON-NLS-0$
				};

				return GitCommitExplorer;
			}());

			return exports;
		}); // end of define
