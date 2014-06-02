/*******************************************************************************
 * @license
 * Copyright (c) 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License v1.0
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html).
 *
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
/*jslint amd:true browser:true mocha:true */
define([
	'chai/chai',
	'js-tests/core/config/mockPrefs',
	'orion/Deferred',
	'orion/config',
	'orion/serviceregistry',
	'orion/pluginregistry',
	'mocha/mocha',
], function(chai, MockPrefsService, Deferred, config, mServiceRegistry, mPluginRegistry) {
	var assert = chai.assert,
	    ConfigAdminFactory = config.ConfigurationAdminFactory,
	    MANAGED_SERVICE = 'orion.cm.managedservice';

	var serviceRegistry, prefsService, pluginRegistry, configAdmin;

	function doSetUp(factories) {
		factories = factories || {};
		var storageFactory = factories.storage || Object.create.bind(Object, Object.prototype);
		var pluginRegistryFactory = factories.pluginRegistry || function(storage) {
			return (window.pluginregistry = new mPluginRegistry.PluginRegistry(serviceRegistry, {storage: storage}));
		};
		var prefsServiceFactory = factories.prefs || function() {
			return new MockPrefsService();
		};
		var configAdminFactoryFactory = factories.config || function (serviceRegistry, pluginRegistry, prefsService) {
			return new ConfigAdminFactory(serviceRegistry, pluginRegistry, prefsService);
		};

		serviceRegistry = new mServiceRegistry.ServiceRegistry();
		pluginRegistry = pluginRegistryFactory(storageFactory());
		return pluginRegistry.start().then(function() {
			prefsService = prefsServiceFactory();
			var configAdminFactory = configAdminFactoryFactory(serviceRegistry, pluginRegistry, prefsService);
			if (!configAdminFactory)
				return new Deferred().resolve();
			return configAdminFactory.getConfigurationAdmin().then(
				function(createdConfigAdmin) {
					configAdmin = createdConfigAdmin;
					return new Deferred().resolve();
				});
		});
	}

	// Hook for before/beforeEach. MUST have 0 declared params, otherwise Mocha thinks you want an async callback
	function setUp() {
		if (arguments.length)
			throw new Error("Do not call this function with parameters, they won't work");
		return doSetUp();
	}

	function tearDown() {
		return pluginRegistry.stop().then(function() {
			serviceRegistry = null;
			prefsService = null;
			pluginRegistry = null;
			configAdmin = null;
		});
	}

	describe("config", function() {
		describe("ConfigurationAdmin", function() {
			beforeEach(setUp);
			afterEach(tearDown);

			it("#getConfiguration", function() {
				var pid = 'test.pid';
				var configuration = configAdmin.getConfiguration(pid);
				assert.strictEqual(configuration.getPid(), pid);
			});
			it("#listConfigurations()", function() {
				var createdConfigs = [];
				for (var i=0; i < 5; i++) {
					var config = configAdmin.getConfiguration('orion.test.pid' + (i+1));
					config.update({foo: (i+1)});
					createdConfigs.push(config);
				}
				var listedConfigs = configAdmin.listConfigurations();
				assert.equal(createdConfigs.length, 5);
				assert.equal(listedConfigs.length, 5);
				assert.ok(createdConfigs.every(function(config) {
					assert.ok(listedConfigs.some(function(config2) {
						return config2.getPid() === config.getPid();
					}), 'Configuration with pid ' + config.getPid() + ' was found');
					return true;
				}));
			});
			it("#update(), #getProperties()", function() {
				var pid = 'test.pid';
				var configuration = configAdmin.getConfiguration(pid);
				var properties = configuration.getProperties();
				assert.strictEqual(configuration.getPid(), pid);
				assert.strictEqual(properties, null);
				configuration.update({
					str: 'blort',
					num: 42,
					nil: null
				});
				properties = configuration.getProperties();
				assert.ok(properties);
				assert.strictEqual(properties.pid, pid);
				assert.strictEqual(properties.str, 'blort');
				assert.strictEqual(properties.num, 42);
				assert.strictEqual(properties.nil, null);
			});
			it("#remove()", function() {
				var pid = 'test.pid';
				var configuration = configAdmin.getConfiguration(pid);
				configuration.update({
					str: 'blort'
				});
				var properties = configuration.getProperties();
				assert.ok(properties);
				assert.strictEqual(properties.pid, pid);
				assert.strictEqual(properties.str, 'blort');
				configuration.remove();

				var listedConfigs = configAdmin.listConfigurations();
				assert.ok(listedConfigs.every(function(config) {
						return config !== null;
					}), 'No null configuration in list');
				assert.ok(listedConfigs.every(function(config) {
					return config && pid !== config.getPid();
				}), 'Removed configuration is not in list');

				configuration = configAdmin.getConfiguration(pid);
				assert.strictEqual(configuration.getProperties(), null);
			});
			it("should use lazy Pref storage for Configurations", function() {
				var pid = 'GRUNNUR';
				var configuration = configAdmin.getConfiguration(pid);
				return prefsService.getPreferences().then(function(preferences) {
					assert.equal(preferences._contains(pid), false, 'config data exists in Prefs');
					configuration.update({foo: 'bar'});
					assert.equal(preferences._contains(pid), true, 'config data exists in Prefs');
				});
			});
		}); // ConfigurationAdmin

		describe("ManagedService", function() {
			beforeEach(setUp);
			afterEach(tearDown);

			describe("#updated", function() {
				it("should be called with `null` for nonexistent config", function() {
					var d = new Deferred();
					serviceRegistry.registerService(MANAGED_SERVICE,
						{	updated: function(properties) {
								try {
									assert.strictEqual(properties, null);
									d.resolve();
								} catch (e) {
									d.reject(e);
								}
							}
						},
						{	pid: 'test.pid'
						});
					return d;
				});
				it("should be called after registering", function() {
					var pid = 'test.pid';
					var configuration = configAdmin.getConfiguration(pid);
					var d = new Deferred();
					configuration.update({
						str: 'zot',
						num: 42,
						nil: null
					});
					// this registration should cause a call to updated(props)
					serviceRegistry.registerService(MANAGED_SERVICE, {
						updated: function(properties) {
							try {
								assert.ok( !! properties);
								assert.strictEqual(properties.pid, pid);
								assert.strictEqual(properties.str, 'zot');
								assert.strictEqual(properties.num, 42);
								assert.strictEqual(properties.nil, null);
								d.resolve();
							} catch (e) {
								d.reject(e);
							}
						}
					}, {
						pid: pid
					});
					return d;
				});
				it("should receive updated props after a Configuration.update()", function() {
					var d = new Deferred();
					var pid = 'orion.test.pid';
					var count = 0;
					// 1st call happens right after registration
					serviceRegistry.registerService(MANAGED_SERVICE,
						{	updated: function(properties) {
								if (++count === 2) {
									try {
										assert.strictEqual(properties.test, 'whee');
										d.resolve();
									} catch (e) {
										d.reject(e);
									}
								}
							}
						},
						{	pid: pid
						});
					var config = configAdmin.getConfiguration(pid);
					// 2nd call happens after this:
					config.update({
						'test': 'whee'
					});
					return d;
				});
				it("should be called with `null` after removing config", function() {
					var d = new Deferred();
					var pid = 'orion.test.pid';
					var count = 0;
					// 1st call happens right after registration
					serviceRegistry.registerService(MANAGED_SERVICE,
						{	updated: function(properties) {
								if (++count === 3) {
									try {
										assert.strictEqual(properties, null);
										d.resolve();
									} catch (e) {
										d.reject(e);
									}
								}
							}
						},
						{	pid: pid
						});
					var config = configAdmin.getConfiguration(pid);
					// 2nd call updated(..) happens after this:
					config.update({
						'test': 'whee'
					});
					// 3rd call happens after this
					config.remove();
					return d;
				});
			});
		}); // ManagedService

		describe("on plugin load", function() {
			afterEach(tearDown);
			this.timeout(20000); // increase timeout since we are dealing with plugins here

			describe("early registration", function() {
				before(setUp);

				it("should have correct updated() call ordering", function() {
					return pluginRegistry.installPlugin('config/testManagedServicePlugin.html').then(function(plugin) {
						return plugin.start({lazy:true}).then(function() {
							var testService = serviceRegistry.getService('test.bogus');
							return testService.test().then(function() {
								return testService.getCallOrder();
							}).then(function(callOrder) {
								assert.deepEqual(callOrder, ['orion.cm.managedservice', 'test.bogus']);
							});
						});
					});
				});
			});

			describe("late registration", function() {
				before(doSetUp.bind(null, {
					config: function() {
						// Don't create config admin in setUp
						return null;
					}
				}));

				// Similar to previous test, but ConfigAdmin is registered after PluginRegistry has started up.
				it("should have correct updated() call ordering", function() {
					return pluginRegistry.installPlugin('config/testManagedServicePlugin.html').then(function(plugin) {
						return plugin.start({lazy:true}).then(function() {
							// Now that the plugin is started, create the config admin
							return new ConfigAdminFactory(serviceRegistry, pluginRegistry, prefsService).getConfigurationAdmin().then(function(createdConfigAdmin) {
								configAdmin = createdConfigAdmin;
								var testService = serviceRegistry.getService('test.bogus');
								return testService.test().then(function() {
									return testService.getCallOrder().then(function(callOrder) {
										assert.deepEqual(callOrder, ['orion.cm.managedservice', 'test.bogus']);
									});
								});
							});
						});
					});
				});
			});
		}); // on plugin load

		describe("cascading", function() {
			function putAll(provider, pids) {
				Object.keys(pids).forEach(function(pid) {
					provider.put(pid, pids[pid]);
				});
			}
			function setUpWithPrefs(prefData) {
				var prefsServiceFactory = function() {
					var ps = new MockPrefsService();
					prefData.defaults && putAll(ps._defaultsProvider, prefData.defaults);
					prefData.user && putAll(ps._userProvider, prefData.user);
					return ps;
				};
				return doSetUp({
					prefs: prefsServiceFactory
				});
			}
			afterEach(tearDown);

			it("PID cascades from default provider", function() {
				return setUpWithPrefs({
					defaults: {
						some_pid: { gak: 42 }
					}
				}).then(function() {
					var configuration = configAdmin.getConfiguration("some_pid");
					var props = configuration.getProperties();
					assert.equal(props.gak, 42);
				});
			});
			it("on collision, user sub-prop overrides default", function() {
				return(setUpWithPrefs({
					defaults: {
						some_pid: { gak: 42 }
					},
					user: {
						some_pid: { gak: -1 }
					}
				})).then(function() {
					var configuration = configAdmin.getConfiguration("some_pid"),
					    props = configuration.getProperties();
					assert.equal(props.gak, -1, "user overrides default");
				});
			});
			// Tests that sub-properties contributed to a PID from defaults provider are visible when user provider
			// defines the same PID
			it("sub-prop cascades from default provider", function() {
				return setUpWithPrefs({
					defaults: {
						some_pid: { gak: 42 }
					},
					user: {
						some_pid: { buzz: 0 }
					}
				}).then(function() {
					var configuration = configAdmin.getConfiguration("some_pid"),
					    props = configuration.getProperties();
					assert.equal(props.gak, 42, "gak is visible");
					assert.equal(props.buzz, 0, "buzz is visible");
				});
			});
			// A setting's value set in the default prefs provider should be observed as the default value of the setting
			it("default value should cascade downwards", function() {
				return setUpWithPrefs({
					defaults: {
						some_pid: { gak: 42 }
					}
				}).then(function() {
					// TODO move this to SettingsRegistry test
					assert.ok(false, "test not finished");
				});
			});
		}); // cascading
	}); // config
});