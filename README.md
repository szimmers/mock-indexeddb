mock-indexeddb
==============

a JS mock for indexeddb, with jasmine examples.

The mock uses built-in timers to simulate async. A number of flags can be toggled in the test setup,
allowing control over success or failure of certain operations, like saving an item, creating a store,
or opening a cursor.

This makes the mock somewhat complicated, and the tests can be complicated to write.

Note: this mock is not exhaustive, but does provide a reasonable amount of functionality. For example, the mock
does not simulate multiple stores. Though dbname is passed to open(), it is ignored.

Assumptions
-----------

These examples assume an AngularJS app where a simple service (let's call it Storage) has been written to wrap IndexedDB, and jasmine/karma are used to write and run tests. Directory structure assumes the project was scaffolded with yo.

The tests below further assume that this Storage service uses promises.

Note: This Storage service is not provided; the tests below are specific to a specific implementation, and may not be useful to your implementation.

Getting Started
---------------

Download indexeddb.js and put it in test/mock. The default karma.conf.js configuration should include the mock. If not, add this line to the files[] configuration:

	'test/mock/**/*.js'

Your Angular service should include a public API to get the indexedDB from window, like this:

		return {
			getIndexedDBReference: function() {
				return indexedDB;
			}

This will allow you to easily spy on the call and return the mock.

Configuring a Describe Block
----------------------------

The beforeEach() should:

* reset the mock
* save data to the mock, if needed
* spy on the call to return the mock

e.g.

		var key1 = 'foo';
		var key2 = 'baz';
		var savedItem1 = {'foo' : 'bar'};
		var savedItem2 = {'baz' : 'bat'};
		var datatypeName = 'does_not_matter';

		beforeEach(inject(function ($injector, $rootScope, $timeout) {
			resetIndexedDBMock();
			commitIndexedDBMockData(key1, savedItem1);
			commitIndexedDBMockData(key2, savedItem2);

			scope = $rootScope.$new();

			service = $injector.get('Storage');
			timeout = $timeout;

			spyOn(service, 'getIndexedDBReference').andReturn(mockIndexedDB);
		}));

Writing a 'get' Test
--------------------

Using the beforeEach() above, a get() call might be first tested like this:

		it('should call openCursor', inject(function () {
			spyOn(window.mockIndexedDBStore, 'openCursor').andCallThrough();

			// the mocked db open has a timer for calling request.onsuccess.
			// we need to pause the test until that time expires (via the
			// mockIndexedDB_openDBSuccess variable), then we can continue.
			runs(function() {
				service.get(datatypeName).then(function(response) {
					scope.data = response;
				});
			});

			waitsFor(function() {
				return window.mockIndexedDB_openDBSuccess;
			}, 'open DB success', 500);

			runs(function() {
				timeout.flush();
				scope.$apply();

				expect(window.mockIndexedDBStore.openCursor).toHaveBeenCalled();
			});
		}));

And then further tested like this:

		it('should return any saved items', inject(function () {
			// the mocked db open has a timer for calling request.onsuccess.
			// we need to pause the test until that time expires (via the
			// mockIndexedDB_openDBSuccess variable), then we can continue.
			runs(function() {
				service.get(datatypeName).then(function(response) {
					scope.data = response;
				});
			});

			waitsFor(function() {
				return window.mockIndexedDB_openDBSuccess;
			}, 'open DB success', 500);

			runs(function() {
				timeout.flush();
				scope.$apply();
			});

			// the mocked cursor has a timer for calling request.onsuccess.
			waitsFor(function() {
				return window.mockIndexedDB_openCursorSuccess;
			}, 'open cursor success', 500);

			// wait for flag telling us the cursor is done reading
			waitsFor(function() {
				return window.mockIndexedDB_cursorReadingDone;
			}, 'cursor done', 500);

			runs(function() {
				timeout.flush();
				scope.$apply();

				expect(scope.data.length).toBe(2);
			});
		}));

The implementation of the cursor looping in the service may look like this:

			var objectStore = openedDB.transaction([storeName], 'readonly').objectStore(storeName);
			var request = objectStore.openCursor();
			var values = [];
			var keys = [];

			request.onsuccess = function(event) {
					var cursor = event.target.result;

					if (cursor) {
						var key = cursor.key;
						var value = cursor.value;

						keys.push(key);

						cursor.continue();
					}
					else {
						openedDB.close();

						var results = {'keys': keys, 'values': values};
						$timeout(function() {
							deferred.resolve(results);
						});
					}
				};

A failure flag can be set, then tested. Here, we are setting the flag to indicate the DB cannot be opened:

		it('should fail if i cannot open the database', inject(function () {
			mockIndexedDBTestFlags.canOpenDB = false;

			runs(function() {
				service.get(datatypeName).then(function(response) {
					scope.data = response;
				}, function(reject) {
					scope.reject = reject;
				});
			});

			waitsFor(function() {
				return window.mockIndexedDB_openDBFail;
			}, 'open DB fail', 100);

			runs(function() {
				timeout.flush();
				scope.$apply();

				expect(scope.reject).toBeDefined();
				expect(scope.data).not.toBeDefined();
			});
		}));

Here, we are setting the flag to indicate the DB cannot be read:

		it('should fail if i cannot read the database', inject(function () {
			runs(function() {
				mockIndexedDBTestFlags.canReadDB = false;

				service.get(datatypeName).then(function(response) {
					scope.data = response;
				}, function(reject) {
					scope.reject = reject;
				});
			});

			waitsFor(function() {
				return window.mockIndexedDB_openDBSuccess;
			}, 'open DB success', 500);

			runs(function() {
				timeout.flush();
				scope.$apply();
			});

			waitsFor(function() {
				return window.mockIndexedDB_openCursorFail;
			}, 'read DB fail', 100);

			runs(function() {
				scope.$apply();

				expect(scope.reject).toBeDefined();
				expect(scope.data).not.toBeDefined();
			});
		}));

Writing a 'save' Test
---------------------

To set up:

		var datatypeName = 'message';
		var key = '1';
		var data1 = {'uniqueId':1, message: 'i like soup.'};

		beforeEach(inject(function ($injector, $rootScope, $timeout) {
			resetIndexedDBMock();

			scope = $rootScope.$new();

			service = $injector.get('Storage');
			timeout = $timeout;

			spyOn(service, 'getIndexedDBReference').andReturn(mockIndexedDB);
		}));

To test:

		it('should call objectstore.put', inject(function () {
			spyOn(window.mockIndexedDBStore, 'put');

			runs(function() {
				service.save(datatypeName, key, data1).then(function(response) {
					scope.data = response;
				});
			});

			waitsFor(function() {
				return window.mockIndexedDB_openDBSuccess;
			}, 'open DB success', 500);

			runs(function() {
				timeout.flush();
				scope.$apply();

				expect(window.mockIndexedDBStore.put).toHaveBeenCalledWith(data1, key);
			});

		}));

Checking a save failure:

		it('should fail if we cannot save', inject(function () {
			runs(function() {
				mockIndexedDBTestFlags.canSave = false;

				service.save(datatypeName, key, data1).then(function(response) {
					scope.data = response;
				}, function(reject) {
					scope.reject = reject;
				});
			});

			waitsFor(function() {
				return window.mockIndexedDB_openDBSuccess;
			}, 'open DB success', 500);

			runs(function() {
				timeout.flush();
				scope.$apply();
			});

			waitsFor(function() {
				return window.mockIndexedDB_saveFail;
			}, 'save fail', 500);

			runs(function() {
				scope.$apply();
				expect(scope.reject).toBeDefined();
				expect(scope.data).not.toBeDefined();
			});
		}));
