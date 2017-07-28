/*   pad Pane
**
*/
var UI = require('solid-ui')
var ns = UI.ns

module.exports = {
  // icon:  (module.__dirname || __dirname) + 'images/ColourOn.png',
  icon: UI.icons.iconBase + 'noun_79217.svg',

  name: 'pad',

  // Does the subject deserve an pad pane?
  label: function (subject) {
    var kb = UI.store
    var t = kb.findTypeURIs(subject)
    if (t['http://www.w3.org/ns/pim/pad#Notepad']) {
      return 'pad'
    }
    return null // No under other circumstances
  },

  mintClass: ns.pad('Notepad'),

  mintNew: function (newPaneOptions) {
    var kb = UI.store
    var ns = UI.ns
    var updater = kb.updater
    var newInstance = newPaneOptions.newInstance = newPaneOptions.newInstance || kb.sym(newPaneOptions.newBase + 'index.ttl#this')
    // var newInstance = kb.sym(newBase + 'pad.ttl#thisPad');
    var newPadDoc = newInstance.doc()

    kb.add(newInstance, ns.rdf('type'), ns.pad('Notepad'), newPadDoc)
    kb.add(newInstance, ns.dc('title'), 'Shared Notes', newPadDoc)
    kb.add(newInstance, ns.dc('created'), new Date(), newPadDoc)
    if (newPaneOptions.me) {
      kb.add(newInstance, ns.dc('author'), newPaneOptions.me, newPadDoc)
    }
    // kb.add(newInstance, ns.pad('next'), newInstance, newPadDoc);
    // linked list empty @@
    var chunk = kb.sym(newInstance.uri + '_line0')
    kb.add(newInstance, ns.pad('next'), chunk, newPadDoc) // Linked list has one entry
    kb.add(chunk, ns.pad('next'), newInstance, newPadDoc)
    kb.add(chunk, ns.dc('author'), newPaneOptions.me, newPadDoc)
    kb.add(chunk, ns.sioc('content'), '', newPadDoc)

    return new Promise(function (resolve, reject) {
      updater.put(
        newPadDoc,
        kb.statementsMatching(undefined, undefined, undefined, newPadDoc),
        'text/turtle',
        function (uri2, ok, message) {
          if (ok) {
            resolve(newPaneOptions)
          } else {
            reject(new Error('FAILED to save new tool at: ' + uri2 + ' : ' +
              message))
          };
        })
    })
  },
  // and follow instructions there
  render: function (subject, dom, paneOptions) {
    // Utility functions
    var complainIfBad = function (ok, message) {
      if (!ok) {
        div.appendChild(UI.widgets.errorMessageBlock(dom, message, 'pink'))
      }
    }

    var clearElement = function (ele) {
      while (ele.firstChild) {
        ele.removeChild(ele.firstChild)
      }
      return ele
    }

    // Access control

    // Two variations of ACL for this app, public read and public read/write
    // In all cases owner has read write control
    var genACLtext = function (docURI, aclURI, allWrite) {
      var g = $rdf.graph()
      var auth = $rdf.Namespace('http://www.w3.org/ns/auth/acl#')
      var a = g.sym(aclURI + '#a1')
      var acl = g.sym(aclURI)
      var doc = g.sym(docURI)
      g.add(a, UI.ns.rdf('type'), auth('Authorization'), acl)
      g.add(a, auth('accessTo'), doc, acl)
      g.add(a, auth('agent'), me, acl)
      g.add(a, auth('mode'), auth('Read'), acl)
      g.add(a, auth('mode'), auth('Write'), acl)
      g.add(a, auth('mode'), auth('Control'), acl)

      a = g.sym(aclURI + '#a2')
      g.add(a, UI.ns.rdf('type'), auth('Authorization'), acl)
      g.add(a, auth('accessTo'), doc, acl)
      g.add(a, auth('agentClass'), ns.foaf('Agent'), acl)
      g.add(a, auth('mode'), auth('Read'), acl)
      if (allWrite) {
        g.add(a, auth('mode'), auth('Write'), acl)
      }
      return $rdf.serialize(acl, g, aclURI, 'text/turtle')
    }

    /**
     * @param docURI
     * @param allWrite
     * @param callback
     *
     * @returns {Promise<Response>}
     */
    var setACL = function setACL (docURI, allWrite, callback) {
      var aclDoc = kb.any(kb.sym(docURI),
        kb.sym('http://www.iana.org/assignments/link-relations/acl')) // @@ check that this get set by web.js

      if (aclDoc) { // Great we already know where it is
        var aclText = genACLtext(docURI, aclDoc.uri, allWrite)

        return fetcher.webOperation('PUT', aclDoc.uri, { data: aclText, contentType: 'text/turtle' })
          .then(result => callback(true))
          .catch(err => {
            callback(false, err.message)
          })
      } else {
        return fetcher.load(docURI)
          .catch(err => {
            callback(false, 'Getting headers for ACL: ' + err)
          })
          .then(() => {
            var aclDoc = kb.any(kb.sym(docURI),
              kb.sym('http://www.iana.org/assignments/link-relations/acl'))

            if (!aclDoc) {
              // complainIfBad(false, "No Link rel=ACL header for " + docURI);
              throw new Error('No Link rel=ACL header for ' + docURI)
            }

            var aclText = genACLtext(docURI, aclDoc.uri, allWrite)

            return fetcher.webOperation('PUT', aclDoc.uri, { data: aclText, contentType: 'text/turtle' })
          })
          .then(result => callback(true))
          .catch(err => {
            callback(false, err.message)
          })
      }
    }

    //  Reproduction: spawn a new instance
    //
    // Viral growth path: user of app decides to make another instance
    var newInstanceButton = function () {
      var button = div.appendChild(dom.createElement('button'))
      button.textContent = 'Start another pad'
      button.addEventListener('click', function () {
        return showBootstrap(subject, spawnArea, 'pad')
      })
      return button
    }

    // Option of either using the workspace system or just typing in a URI
    var showBootstrap = function showBootstrap (thisInstance, container, noun) {
      var div = clearElement(container)
      var na = div.appendChild(UI.authn.newAppInstance(
        dom, 'Start a new ' + noun + ' in a workspace', initializeNewInstanceInWorkspace))

      var hr = div.appendChild(dom.createElement('hr')) // @@

      var p = div.appendChild(dom.createElement('p'))
      p.textContent = 'Where would you like to store the data for the ' + noun + '?  ' +
        'Give the URL of the directory where you would like the data stored.'
      var baseField = div.appendChild(dom.createElement('input'))
      baseField.setAttribute('type', 'text')
      baseField.size = 80 // really a string
      baseField.label = 'base URL'
      baseField.autocomplete = 'on'

      div.appendChild(dom.createElement('br')) // @@

      var button = div.appendChild(dom.createElement('button'))
      button.textContent = 'Start new ' + noun + ' at this URI'
      button.addEventListener('click', function (e) {
        var newBase = baseField.value
        if (newBase.slice(-1) !== '/') {
          newBase += '/'
        }
        initializeNewInstanceAtBase(thisInstance, newBase)
      })
    }

    //  Create new document files for new instance of app
    var initializeNewInstanceInWorkspace = function (ws) {
      var newBase = kb.any(ws, ns.space('uriPrefix'))
      if (!newBase) {
        newBase = ws.uri.split('#')[0]
      } else {
        newBase = newBase.value
      }
      if (newBase.slice(-1) !== '/') {
        $rdf.log.error(appPathSegment + ': No / at end of uriPrefix ' + newBase) // @@ paramater?
        newBase = newBase + '/'
      }
      var now = new Date()
      newBase += appPathSegment + '/id' + now.getTime() + '/' // unique id

      initializeNewInstanceAtBase(thisInstance, newBase)
    }

    var initializeNewInstanceAtBase = function (thisInstance, newBase) {
      var here = $rdf.sym(thisInstance.uri.split('#')[0])

      var sp = UI.ns.space
      var kb = UI.store

      var newPadDoc = kb.sym(newBase + 'pad.ttl')
      var newIndexDoc = kb.sym(newBase + 'index.html')

      toBeCopied = [
        { local: 'index.html', contentType: 'text/html' }
      ]

      newInstance = kb.sym(newPadDoc.uri + '#thisPad')

      // $rdf.log.debug("\n Ready to put " + kb.statementsMatching(undefined, undefined, undefined, there)); //@@

      agenda = []

      var f, fi, fn //   @@ This needs some form of visible progress bar
      for (f = 0; f < toBeCopied.length; f++) {
        var item = toBeCopied[f]
        var fun = function copyItem (item) {
          agenda.push(function () {
            var newURI = newBase + item.local
            console.log('Copying ' + base + item.local + ' to ' + newURI)

            var setThatACL = function () {
              setACL(newURI, false, function (ok, message) {
                if (!ok) {
                  complainIfBad(ok, 'FAILED to set ACL ' + newURI + ' : ' + message)
                  console.log('FAILED to set ACL ' + newURI + ' : ' + message)
                } else {
                  agenda.shift()() // beware too much nesting
                }
              })
            }

            kb.fetcher.webCopy(base + item.local, newBase + item.local, item.contentType)
              .then(() => UI.authn.checkUser())
              .then(webId => {
                me = webId

                setThatACL()
              })
              .catch(err => {
                console.log('FAILED to copy ' + base + item.local + ' : ' + err.message)
                complainIfBad(false, 'FAILED to copy ' + base + item.local + ' : ' + err.message)
              })
          })
        }
        fun(item)
      }

      agenda.push(function createNewPadDataFile () {
        kb.add(newInstance, ns.rdf('type'), PAD('Notepad'), newPadDoc)

        kb.add(newInstance, ns.dc('created'), new Date(), newPadDoc)
        if (me) {
          kb.add(newInstance, ns.dc('author'), me, newPadDoc)
        }
        kb.add(newInstance, PAD('next'), newInstance, newPadDoc) // linked list empty

        // Keep a paper trail   @@ Revisit when we have non-public ones @@ Privacy
        kb.add(newInstance, UI.ns.space('inspiration'), thisInstance, padDoc)
        kb.add(newInstance, UI.ns.space('inspiration'), thisInstance, newPadDoc)

        updater.put(
          newPadDoc,
          kb.statementsMatching(undefined, undefined, undefined, newPadDoc),
          'text/turtle',
          function (uri2, ok, message) {
            if (ok) {
              agenda.shift()()
            } else {
              complainIfBad(ok, 'FAILED to save new notepad at: ' + there.uri + ' : ' + message)
              console.log('FAILED to save new notepad at: ' + there.uri + ' : ' + message)
            }
          }
        )
      })

      agenda.push(function () {
        setACL(newPadDoc.uri, true, function (ok, body) {
          complainIfBad(ok, 'Failed to set Read-Write ACL on pad data file: ' + body)
          if (ok) agenda.shift()()
        })
      })

      agenda.push(function () {
        // give the user links to the new app

        var p = div.appendChild(dom.createElement('p'))
        p.setAttribute('style', 'font-size: 140%;')
        p.innerHTML =
          "Your <a href='" + newIndexDoc.uri + "'><b>new notepad</b></a> is ready. " +
          "<br/><br/><a href='" + newIndexDoc.uri + "'>Go to new pad</a>"
      })

      agenda.shift()()
      // Created new data files.
    }

    //  Update on incoming changes
    var showResults = function (exists) {
      console.log('showResults()')

      UI.authn.checkUser()
        .then(webId => {
          me = webId
        })

      var title = kb.any(subject, ns.dc('title')) || kb.any(subject, ns.vcard('fn'))
      if (paneOptions.solo && typeof window !== 'undefined' && title) {
        window.document.title = title.value
      }
      options.exists = exists
      padEle = (UI.pad.notepad(dom, padDoc, subject, me, options))
      naviMain.appendChild(padEle)

      var partipationTarget = kb.any(subject, ns.meeting('parentMeeting')) || subject
      UI.pad.manageParticipation(dom, naviMiddle2, padDoc, partipationTarget, me, options)

      var initiated = UI.store.updater.setRefreshHandler(padDoc, padEle.reloadAndSync)
    }

    // Read or create empty data file
    var loadPadData = function () {
      fetcher.nowOrWhenFetched(padDoc.uri, undefined, function (ok, body, response) {
        if (!ok) {
          if (response.status === 404) { // /  Check explicitly for 404 error
            console.log('Initializing results file ' + padDoc)
            updater.put(padDoc, [], 'text/turtle', function (uri2, ok, message) {
              if (ok) {
                clearElement(naviMain)
                showResults(false)
              } else {
                complainIfBad(ok, 'FAILED to create results file at: ' + padDoc.uri + ' : ' + message)
                console.log('FAILED to craete results file at: ' + padDoc.uri + ' : ' + message)
              }
            })
          } else {  // Other error, not 404 -- do not try to overwite the file
            complainIfBad(ok, 'FAILED to read results file: ' + body)
          }
        } else {  // Happy read
          clearElement(naviMain)
          if (kb.holds(subject, ns.rdf('type'), ns.wf('TemplateInstance'))) {
            showBootstrap(subject, naviMain, 'pad')
          }
          showResults(true)
          naviMiddle3.appendChild(newInstanceButton())
        }
      })
    }

    //  Body of Pane
    var appPathSegment = 'app-pad.timbl.com' // how to allocate this string and connect to

    var kb = UI.store
    var fetcher = UI.store.fetcher
    var updater = UI.store.updater
    var ns = UI.ns
    var me

    var PAD = $rdf.Namespace('http://www.w3.org/ns/pim/pad#')

    var thisInstance = subject
    var padDoc = subject.doc()

    var padEle

    var div = dom.createElement('div')

    //  Build the DOM
    var structure = div.appendChild(dom.createElement('table')) // @@ make responsive style
    structure.setAttribute('style', 'background-color: white; min-width: 94%; margin-right:3% margin-left: 3%; min-height: 13em;')

    var naviLoginoutTR = structure.appendChild(dom.createElement('tr'))
    var naviLoginout1 = naviLoginoutTR.appendChild(dom.createElement('td'))
    var naviLoginout2 = naviLoginoutTR.appendChild(dom.createElement('td'))
    var naviLoginout3 = naviLoginoutTR.appendChild(dom.createElement('td'))

    var logInOutButton = null

    var naviTop = structure.appendChild(dom.createElement('tr')) // stuff
    var naviMain = naviTop.appendChild(dom.createElement('td'))
    naviMain.setAttribute('colspan', '3')

    var naviMiddle = structure.appendChild(dom.createElement('tr')) // controls
    var naviMiddle1 = naviMiddle.appendChild(dom.createElement('td'))
    var naviMiddle2 = naviMiddle.appendChild(dom.createElement('td'))
    var naviMiddle3 = naviMiddle.appendChild(dom.createElement('td'))

    var naviStatus = structure.appendChild(dom.createElement('tr')) // status etc
    var statusArea = naviStatus.appendChild(dom.createElement('div'))

    var naviSpawn = structure.appendChild(dom.createElement('tr')) // create new
    var spawnArea = naviSpawn.appendChild(dom.createElement('div'))

    var naviMenu = structure.appendChild(dom.createElement('tr'))
    naviMenu.setAttribute('class', 'naviMenu')
//    naviMenu.setAttribute('style', 'margin-top: 3em;');
    var naviLeft = naviMenu.appendChild(dom.createElement('td'))
    var naviCenter = naviMenu.appendChild(dom.createElement('td'))
    var naviRight = naviMenu.appendChild(dom.createElement('td'))

    var options = { statusArea: statusArea, timingArea: naviMiddle1 }

    loadPadData()

    return div
  }
}
// ends
