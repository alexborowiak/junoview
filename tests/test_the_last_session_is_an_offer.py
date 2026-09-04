"""What you had open is an offer, not a decision (T241).

The user, 2026-09-04: "I do not like how it automatically opens what
was last open. That is too aggressive. Just have options to open what
was previously open."

Driven on a web build with a seeded session of two notebooks: nothing
opened on load (0 tabs), and the welcome screen carried a "last time"
row reading "Open the 2 notebooks you had open".
"""

from __future__ import annotations

from junoview import assets


def test_nothing_opens_itself_on_load():
    app = assets.app_js()
    # the list is still read, and still exact
    assert "    function restoreWebSession(){" in app
    assert "        localStorage.getItem(WEBKEY+':open')||'[]');}catch(e){}" in app
    # ...but it is stored, not acted on
    assert "      APP.lastSession=open;" in app
    assert "      open.forEach(function(u){webOpenUrl(u,true);});" not in app


def test_there_is_a_button_that_does_it():
    app = assets.app_js()
    assert "    APP.openLastSession=function(){" in app
    assert ("      (APP.lastSession||[]).forEach(function(u){"
            "webOpenUrl(u,false);});") in app
    # opening them leaves the welcome screen, which is where you pressed it
    assert "      goHome(false);" in app
    # ...and the offer goes away once taken
    assert "      APP.lastSession=[];" in app


def test_the_offer_is_a_row_on_the_welcome_screen():
    page = assets.load("html/page.html")
    assert 'id="welcome-last"' in page
    assert page.index('id="welcome-last"') < page.index('id="welcome-recent"')
    app = assets.app_js()
    assert "  function renderLastSession(){" in app
    assert "    h.textContent='last time';host.appendChild(h);" in app
    assert ("    nm.textContent='Open the '+last.length+' notebook'\n"
            "      +(last.length===1?'':'s')+' you had open';") in app
    # one button for the lot: "where I was" is one thought
    assert "      if(APP.openLastSession) APP.openLastSession();});" in app
    # ...and the band it sits in knows about it
    assert ("    w.hidden=!((r&&!r.hidden)||(pz&&!pz.hidden)"
            "||(ls&&!ls.hidden));") in app
    assert "    renderLastSession();\n  }\n  APP.refreshChrome=refreshChrome;" in app
