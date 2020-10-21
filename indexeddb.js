/**
 * Mocked indexeddb
 * 
 * https://github.com/szimmers/mock-indexeddb
 */

const ERROR_CODE = 1
const ERROR_MESSAGE = 'fail'

// mock saves objects here
const items = []

// used for waitFor()'s in tests
let openDBSuccess = false
let openDBFail = false
let openDBAbort = false
let openDBBlocked = false
let openDBUpgradeNeeded = false

let openCursorSuccess = false
let openCursorFail = false
let cursorReadingDone = false

let saveSuccess = false
let saveFail = false
let deleteSuccess = false
let deleteFail = false
let clearSuccess = false
let clearFail = false
let createStoreSuccess = false
let createStoreFail = false
let deleteDBSuccess = false
let deleteDBFail = false

// used for reading objects
let cursorResultsIndex = 0

// test flags
const testFlags = {
  canOpenDB: true,
  openDBShouldBlock: false,
  openDBShouldAbort: false,
  upgradeNeeded: false,
  canReadDB: true,
  canSave: true,
  canDelete: true,
  canClear: true,
  canCreateStore: true,
  canDeleteDB: true
}

// timers are used to handle callbacks
let openDBTimer
let createObjectStoreTimer
let cursorContinueTimer
let storeAddTimer
let storeDeleteTimer
let storeClearTimer
let storeOpenCursorTimer
let deleteDBTimer

/**
 * call this in beforeEach() to reset the mock
 */
function reset() {
  items.length = 0

  openDBSuccess = false
  openDBFail = false
  openDBAbort = false
  openDBBlocked = false
  openDBUpgradeNeeded = false

  openCursorSuccess = false
  openCursorFail = false
  cursorReadingDone = false

  saveSuccess = false
  saveFail = false
  deleteSuccess = false
  deleteFail = false
  clearSuccess = false
  clearFail = false
  createStoreSuccess = false
  createStoreFail = false
  deleteDBSuccess = false
  deleteDBFail = false

  cursorResultsIndex = 0

  testFlags.canOpenDB = true
  testFlags.openDBShouldBlock = false
  testFlags.openDBShouldAbort = false
  testFlags.canReadDB = true
  testFlags.canSave = true
  testFlags.canDelete = true
  testFlags.canCreateStore = true
  testFlags.canDeleteDB = true

  clearTimeout(openDBTimer)
  clearTimeout(createObjectStoreTimer)
  clearTimeout(cursorContinueTimer)
  clearTimeout(storeAddTimer)
  clearTimeout(storeDeleteTimer)
  clearTimeout(storeClearTimer)
  clearTimeout(storeOpenCursorTimer)
  clearTimeout(deleteDBTimer)
}

/**
 * call this in beforeEach() to 'save' data before a test
 */
function commitData(key, value) {
  const item = {
    key,
    value
  }

  items.push(item)
}

/**
 * the cursor works like an indexeddb one, where calling continue() will provide
 * next item. items must be saved with the commitData() method in
 * order to be returned by the cursor.
 */
let cursor = {
  identity: 'cursor',

  continue: function() {
    cursorResultsIndex++
    openCursorSuccess = false

    cursorContinueTimer = setTimeout(function() {
      cursorRequest.callSuccessHandler()
      openCursorSuccess = true
    }, 20)

    return cursorRequest
  }
}

/**
 * with each call to continue() to get the cursor, the object will
 * have a key and value property. these are defined by the getters.
 */
cursor.__defineGetter__('key', function() {
  if (cursorResultsIndex < items.length) {
    const item = items[cursorResultsIndex]
    return item.key
  }
  else {
    return null
  }
})

cursor.__defineGetter__('value', function() {
  if (cursorResultsIndex < items.length) {
    const item = items[cursorResultsIndex]
    return item.value
  }
  else {
    return null
  }
})

cursor.__defineGetter__('resultCount', function() {
  return items.length
})

let cursorRequest = {
  callSuccessHandler: function() {
    if (this.onsuccess !== null) {

      let cursorToReturn

      if (cursorResultsIndex < items.length) {
        cursorToReturn = cursor
        cursorReadingDone = false
      }
      else {
        cursorToReturn = null
        cursorReadingDone = true
      }

      const event = {
        type: 'success',
        bubbles: false,
        cancelable: true,
        target: {
          result: cursorToReturn
        }
      }

      this.onsuccess(event)
    }
  },

  callErrorHandler: function() {
    if (this.onerror !== null) {

      const event = {
        type: 'error',
        bubbles: true,
        cancelable: true,
        target: {
          errorCode: ERROR_CODE // this is a made-up code
        }
      }

      this.onerror(event)
    }
  }
}

let storeTransaction = {
  callSuccessHandler: function() {
    if (this.onsuccess !== null) {
      const event = new CustomEvent('success', { bubbles: false, cancelable: true })
      this.onsuccess(event)
    }
  },

  callErrorHandler: function() {
    if (this.onerror !== null) {
      const event = {
        type: 'error',
        bubbles: true,
        cancelable: true,
        target: {
          errorCode: ERROR_CODE // this is a made-up code
        }
      }
      this.onerror(event)
    }
  }
}

let store = {
  identity: 'store',

  // add returns a different txn than delete does. in indexedDB, the listeners are
  // attached to the txn that returned the store.
  add: function(data) {
    if (testFlags.canSave === true) {
      items.push(data)
      storeAddTimer = setTimeout(function() {
        transaction.callCompleteHandler()
        saveSuccess = true
      }, 20)
    }
    else {
      storeAddTimer = setTimeout(function() {
        transaction.callErrorHandler()
        saveFail = true
      }, 20)
    }

    return transaction
  },

  // for now, treating put just like an add.
  // TODO: do an update instead of adding
  put: function(data) {
    if (testFlags.canSave === true) {
      items.push(data)
      storeAddTimer = setTimeout(function() {
        transaction.callCompleteHandler()
        saveSuccess = true
      }, 20)
    }
    else {
      storeAddTimer = setTimeout(function() {
        transaction.callErrorHandler()
        saveFail = true
      }, 20)
    }

    return transaction
  },

  // for delete, the listeners are attached to a request returned from the store.
  delete: function(data_id) {
    if (testFlags.canDelete === true) {
      storeDeleteTimer = setTimeout(function() {
        storeTransaction.callSuccessHandler()
        deleteSuccess = true
      }, 20)
    }
    else {
      storeDeleteTimer = setTimeout(function() {
        storeTransaction.callErrorHandler()
        deleteFail = true
      }, 20)
    }

    return storeTransaction
  },

  // for clear, the listeners are attached to a request returned from the store.
  clear: function(data_id) {
    if (testFlags.canClear === true) {
      storeClearTimer = setTimeout(function() {
        storeTransaction.callSuccessHandler()
        clearSuccess = true
      }, 20)
    }
    else {
      storeClearTimer = setTimeout(function() {
        storeTransaction.callErrorHandler()
        clearFail = true
      }, 20)
    }

    return storeTransaction
  },

  createIndex: function(key, params) {

  },

  callSuccessHandler: function() {
    if (this.onsuccess !== null) {
      const event = new CustomEvent('success', { bubbles: false, cancelable: true })
      this.onsuccess(event)
    }
  },

  callErrorHandler: function() {
    if (this.onerror !== null) {
      const event = {
        type: 'error',
        bubbles: true,
        cancelable: true,
        target: {
          errorCode: ERROR_CODE // this is a made-up code
        }
      }
      this.onerror(event)
    }
  },

  openCursor: function() {
    if (testFlags.canReadDB === true) {
      storeOpenCursorTimer = setTimeout(function() {
        cursorRequest.callSuccessHandler()
        openCursorSuccess = true
      }, 20)
    }
    else {
      storeOpenCursorTimer = setTimeout(function() {
        cursorRequest.callErrorHandler()
        openCursorFail = true
      }, 20)
    }

    return cursorRequest
  }
}

let transaction = {
  objectStore: function(name) {
    return store
  },

  callCompleteHandler: function() {
    if (this.oncomplete !== null) {
      const event = new CustomEvent('complete', { bubbles: false, cancelable: true })
      this.oncomplete(event)
    }
  },

  callErrorHandler: function() {
    if (this.onerror !== null) {
      const event = {
        type: 'error',
        bubbles: true,
        cancelable: true,
        target: {
          errorCode: ERROR_CODE // this is a made-up code
        }
      }
      this.onerror(event)
    }
  }
}

let database = {
  transaction: function(stores, access) {
    return transaction
  },

  close: function() {},

  objectStoreNames: {
    contains: function(name) {
      return false
    }
  },

  createObjectStore: function(name, params) {
    if (testFlags.canCreateStore === true) {
      createObjectStoreTimer = setTimeout(function() {
        store.callSuccessHandler()
        createStoreSuccess = true
      }, 20)
    }
    else {
      createObjectStoreTimer = setTimeout(function() {
        store.callErrorHandler()
        createStoreFail = true
      }, 20)
    }

    return store
  }
}

let openDBRequest = {
  callSuccessHandler: function() {
    if (this.onsuccess !== null) {
      const event = document.createEvent('CustomEvent')
      event.initCustomEvent('success', false, false, { bubbles: false, cancelable: true })
      this.onsuccess(event)
    }
  },

  callErrorHandler: function() {
    if (this.onerror !== null) {
      const event = {
        type: 'error',
        bubbles: true,
        cancelable: true,
        target: {
          errorCode: ERROR_CODE, // this is a made-up code
          error: {
            message: ERROR_MESSAGE // this is a made-up message
          }
        }
      }
      this.onerror(event)
    }
  },

  callAbortHandler: function() {
    if (this.onblocked !== null) {
      const event = {
        type: 'error',
        bubbles: true,
        cancelable: true,
        target: {
          errorCode: ERROR_CODE, // this is a made-up code
          error: {
            message: ERROR_MESSAGE // this is a made-up message
          }
        }
      }
      this.onblocked(event)
    }
  },

  callBlockedHandler: function() {
    if (this.onabort !== null) {
      const event = {
        type: 'error',
        bubbles: true,
        cancelable: true,
        target: {
          errorCode: ERROR_CODE, // this is a made-up code
          error: {
            message: ERROR_MESSAGE // this is a made-up message
          }
        }
      }
      this.onabort(event)
    }
  },

  callUpgradeNeeded: function() {
    if (this.onupgradeneeded !== null) {
      const event = {
        type: 'upgradeneeded',
        bubbles: false,
        cancelable: true,
        target: {
          result: database,
          transaction: {
            abort: function() {
              testFlags.openDBShouldAbort = true
            }
          }
        }
      }
      this.onupgradeneeded(event)
    }
  },

  result: database
}

const deleteDBRequest = {
  callSuccessHandler: function() {
    if (this.onsuccess !== null) {
      const event = new CustomEvent('success', { bubbles: false, cancelable: true })
      this.onsuccess(event)
    }
  },

  callErrorHandler: function() {
    if (this.onerror !== null) {
      const event = {
        type: 'error',
        bubbles: true,
        cancelable: true,
        target: {
          errorCode: ERROR_CODE, // this is a made-up code
          error: {
            message: ERROR_MESSAGE // this is a made-up message
          }
        }
      }
      this.onerror(event)
    }
  },

  callAbortHandler: function() {
    if (this.onblocked !== null) {
      const event = {
        type: 'error',
        bubbles: true,
        cancelable: true,
        target: {
          errorCode: ERROR_CODE, // this is a made-up code
          error: {
            message: ERROR_MESSAGE // this is a made-up message
          }
        }
      }
      this.onblocked(event)
    }
  },

  callBlockedHandler: function() {
    if (this.onabort !== null) {
      const event = {
        type: 'error',
        bubbles: true,
        cancelable: true,
        target: {
          errorCode: ERROR_CODE, // this is a made-up code
          error: {
            message: ERROR_MESSAGE // this is a made-up message
          }
        }
      }
      this.onabort(event)
    }
  },

  result: {}
}

/**
 * this mocks the window.indexedDB object. assuming a method that returns that object, this mock
 * object can be substituted like this:
 *
 * spyOn(service, 'getIndexedDBReference').andReturn(mockIndexedDB)
 */
const mockIndexedDB = {
  identity: 'mockedIndexDB',

  // note: the mock does not simulate separate stores, so dbname is ignored
  open: function(dbname, version) {
    if (testFlags.openDBShouldBlock === true) {
      openDBTimer = setTimeout(function() {
        openDBRequest.callBlockedHandler()
        openDBBlocked = true
      }, 20)
    }
    else if (testFlags.openDBShouldAbort === true) {
      openDBTimer = setTimeout(function() {
        openDBRequest.callAbortHandler()
        openDBAbort = true
      }, 20)
    }
    else if (testFlags.upgradeNeeded === true) {
      openDBTimer = setTimeout(function() {
        openDBRequest.callUpgradeNeeded()
        openDBUpgradeNeeded = true
      }, 20)
    }
    // these are order dependent, so we don't have to set so many
    // flags in the test. can leave 'canOpenDB' in its default
    // true state, so long as the other fail vars are checked first.
    else if (testFlags.canOpenDB === true) {
      openDBTimer = setTimeout(function() {
        openDBRequest.callSuccessHandler()
        openDBSuccess = true
      }, 20)
    }
    else {
      openDBTimer = setTimeout(function() {
        openDBRequest.callErrorHandler()
        openDBFail = true
      }, 20)
    }

    return openDBRequest
  },

  deleteDatabase: function(dbname) {
    if (testFlags.canDeleteDB === true) {
      deleteDBTimer = setTimeout(function() {
        deleteDBRequest.callSuccessHandler()
        deleteDBSuccess = true
      }, 20)
    }
    else {
      deleteDBTimer = setTimeout(function() {
        deleteDBRequest.callErrorHandler()
        deleteDBFail = true
      }, 20)
    }

    return deleteDBRequest
  }

}

// Set window property to mock
window.indexedDB = mockIndexedDB

export default {
  reset,
  commitData
}
