//Usage: no JavaScript interaction is required, just add data-tttype attribute to your HTML table and the tool will be added automatically at page load.
//You just need to specify a type of "fixed" or "sticky."
//Currently issue with min-width IE7
//Caller of setLimits should wait until after load instead of on ready
//If toggling on and off the tabletool, it is best to select a wrapping element to toggle rather than the table itself.
//Tables nested inside of other tables will be skipped by the TableTool.
//Pass in a number greater than 0 to signify the cells acting as a side column with data-tttype="sidescroll" tables.
//jQuery Event handlers are maintained in cloned headers and footer. Events should be attached before the TableTool script runs in order to capture attached events.

'use strict';

var scrollbarWidth = {};

function getScrollbarWidth(targetClass) {
	targetClass = targetClass || 'getScrollbarWidth';

	if (!scrollbarWidth[targetClass]) {
		var outer = document.createElement('div'),
		inner = document.createElement('p'),
		w1 = null,
		w2 = null;

		outer.appendChild(inner);
		document.body.appendChild(outer);

		outer.className = targetClass;
		outer.style.position = 'fixed';
		outer.style.width = '100px';

		w1 = inner.offsetWidth;
		outer.style.overflow = 'scroll';
		w2 = inner.offsetWidth;

		if (w1 === w2 && outer.clientWidth) {
			w2 = outer.clientWidth;
		}

		document.body.removeChild(outer);
		scrollbarWidth[targetClass] = w1 - w2;
	}

	return scrollbarWidth[targetClass];
}

//API access
var TableTool = {};

(function(j) {

	//Declare global objects
	var win = null,
		body = null,
		topEleWrap = null,
		btmEleWrap = null,
		topElement = null,
		btmElement = null,
		scrTimer = null, // scroll time
		CONST_THEAD = 0,
		CONST_TFOOT = 1,
		allStickies = [],
		allFixed = [],
		allSidescrolls = [];

	function init() {
		//Check for adding or removing of tables
		var tables = j('table[data-tttype]');
		win = j(window);
		body = j(document.body);

		tables.each(function(idx, ele) {
			var el = j(ele),
				proceed = true;

			if (
				//if table height is zero, do not initialize TableTool on this table
				el.height() <= 0 ||
				//if table is nested inside an ancestor table, do not initialize TableTool on this table
				el.parents('table').length !== 0
				) {
				proceed = false;
			}

			if (proceed) {
				switch (el.data('tttype')) {
					case 'fixed':
						//for each instance run the function
						fixedWrap(ele, el.data('ttheight') || 300);
						break;
					case 'sticky':
						//for each instance run the function
						stickyWrap(ele);
						break;
					case 'sidescroll':
						sidescrollWrap(ele, el.data('ttsidecells'));
						break;
				}
			}
		});
	}

	function setupDetection() {
		//if TableTool table is removed, stop running code on it and remove from array. This checks both the body height and compares the number of tabletool tables with a baseline
		var heightBaseline = body[0].scrollHeight, // get scroll height which is the total page height regardless of win size
			ttTablesInBaseline = j('.tabletool').length;

		var loop = setInterval(function() {
			var bodyHeight = body[0].scrollHeight, // get scroll height which is the total page height regardless of win size
				ttTablesInDOM = j('.tabletool').length;

			//compare body height to check if table has been removed / user could set height to 100% or a fixed value like 1000px
			if (bodyHeight > heightBaseline) {
				TableTool.init();
			}
			else if (bodyHeight < heightBaseline) {
				checkTableToolExists();
			}

			//compare number of tabletools found with baseline
			else if (ttTablesInDOM < ttTablesInBaseline) {
				checkTableToolExists();
			}
			else if (ttTablesInDOM > ttTablesInBaseline) {
				ttTablesInBaseline = ttTablesInDOM;
			}

			if (j('table[data-tttype]').length) {
				TableTool.init();
			}

			heightBaseline = bodyHeight;
		}, 1000);
	}

	function checkTableToolExists() {
		for (var i=0; i<allStickies.length; i++) {
			var stickyObj = allStickies[i],
				outermostEle = j(stickyObj.parent[0]);

			//Attach ID and search DOM for it
			outermostEle.attr('id', 'test_ttsticky_exist');
			if (document.getElementById('test_ttsticky_exist')) {
				outermostEle.removeAttr('id', 'test_ttsticky_exist');
			} else {
				win.off({
					'resize' : stickyObj.windowResize,
					'scroll' : stickyObj.setStickies
				});
				j(stickyObj).empty();
				stickyObj = null;
				allStickies.splice(i, 1);
			}
		}

		for (var i=0; i<allFixed.length; i++) {
			var fixedObj = allFixed[i],
				outermostEle = j(fixedObj.parent[0]);

			//Attach ID and search DOM for it
			outermostEle.attr('id', 'test_ttfixed_exist');
			if (document.getElementById('test_ttfixed_exist')) {
				outermostEle.removeAttr('id', 'test_ttfixed_exist');
			} else {
				win.off('resize', fixedObj.windowResize);
				j(fixedObj).empty();
				fixedObj = null;
				allFixed.splice(i, 1);
			}
		}
	}

	function uniqueIDs(clonedEle) {
		function convertIDs(loopEle) { // perform the conversion. Add "-tt" to existing ID's
			if (loopEle && loopEle.find) {
				loopEle.find('[id]').each(function(idx, ele) {
					ele.id += '-tt';
				});
			}
		}

		function plainAry(clonedEle) { // helper function for plain arrays
			for (var i = 0; i < clonedEle.length; i++) {
				convertIDs(clonedEle[i]);
			}
		}

		if (j.isArray(clonedEle)) { // if plain array [1,2,3] not "array like" jQuery object. If invoked like this uniqueIDs([jqEle1, jqEle2]);
			plainAry(clonedEle);
		} else {
			if (arguments.length > 1) { // if invoked like this uniqueIDs(jqEle1, jqEle2);
				plainAry(arguments);
			} else {
				convertIDs(clonedEle); // if invoked like this uniqueIDs(jqEle1);
			}
		}

		return clonedEle;
	}

	function scrollTracker(pos, trkEle, clsEle) {
		var scrEle = j(trkEle);

		function trackPos(manPos) {
			var maxScroll = (scrEle[0].scrollWidth - scrEle.outerWidth()),
				jqCls = (clsEle ? j(clsEle) : scrEle).removeClass('atLeft atRight'),
				scrollPos = (typeof manPos === 'undefined' ? scrEle.scrollLeft() : manPos);

			if (maxScroll) {
				if (scrollPos === 0) {
					jqCls.addClass('atLeft');
				} else if (Math.round(scrollPos) >= Math.round(maxScroll)) {
					jqCls.addClass('atRight');
				}
			}
		}

		if (pos) {
			trackPos();
		} else {
			setTimeout(function() {
				trackPos(0); // wait for elements to be resized before making this calculation
			}, 100);

			scrEle.on('scroll', function() {
				clearTimeout(scrTimer);
				scrTimer = setTimeout(trackPos, 100);
			});
		}
	}

	function fixedWrap(table, height) {
		var fixed = {},
			colWidth = [],
			mouseWheel = {},
			timer = null,
			startData = [],
			dragData = [],
			footerExists,
			wheelEvent = false;

		fixed.parent = j('<div class="tabletool ttfixed"></div>');
		fixed.table = j(table);
		//remove data attribute from original table
		fixed.table.removeAttr('data-tttype');
		fixed.table.wrap(fixed.parent);

		//set tabletool var to $jquery object for future reference
		fixed.parent = fixed.table.parent().attr('data-ttID', Math.floor(Math.random()*1000000000000));
		fixed.table.wrap('<div class="outer"><div class="inner"></div></div>');

		//declare wrapping div elements
		fixed.tbody = fixed.table.parents('.outer');
		fixed.tfoot = fixed.tbody.clone(true).addClass('tfoot').appendTo(fixed.parent);
		fixed.thead = fixed.tbody.clone(true).addClass('thead atTop').appendTo(fixed.parent);

		fixed.tbody.addClass('tbody');
		fixed.theadTable = fixed.thead.find('table').removeAttr('id data-ttheight');
		fixed.theadTable.children('tfoot, tbody').remove();
		fixed.tfootTable = fixed.tfoot.find('table').removeAttr('id data-ttheight');
		fixed.tfootTable.children('tbody, thead, caption').remove();

		// give cloned header and footer unique IDs. Wait until after append complete
		uniqueIDs(fixed.thead, fixed.tfoot);

		fixed.tbody.css('max-height', height);
		fixed.orgHead = fixed.tbody.find('thead');
		fixed.orgFoot = fixed.tbody.find('tfoot');
		fixed.tbodyInner = fixed.tbody.find('.inner');

		//sort elements in our header and footer into their own respective columns
		fixed.sortHead = fixed.orgHead.length ? sortCols(fixed, CONST_THEAD) : false;
		fixed.sortFoot = fixed.orgFoot.length ? sortCols(fixed, CONST_TFOOT) : false;

		//fieldset fix
		fixed.parent.parents('fieldset').addClass('ttFieldsetFix');

		//methods
		fixed.setHeadHeight = function () {
			var fixedHeadHeight = fixed.theadTable.outerHeight(),
				fixedFootHeight = fixed.orgFoot.height(),
				resizeWidth = fixed.tbodyInner.width(),
				fixedMaxHeight = parseInt(fixed.tbody.css('max-height')),
				orgWidth = fixed.table.width();

			if (fixed.tbody.height() < fixedMaxHeight) {
				fixed.tbody.addClass('noScrolling');
				fixed.thead.removeClass('atTop');
				fixed.tfoot.removeClass('atBottom');
			} else if (fixed.tbody.hasClass('noScrolling')) {
				fixed.thead.addClass('atTop');
				fixed.tbody.removeClass('noScrolling');
			}

			if (win.height() < fixedHeadHeight + fixedFootHeight + 100) {
				fixed.parent.addClass('unsupported');
			} else {
				fixed.parent.removeClass('unsupported');
			}

			if (resizeWidth < orgWidth) {
				if (fixed.orgFoot.length) {
					fixed.parent.css('overflow', 'auto');
					fixed.tbody.css('margin-bottom', getScrollbarWidth('outer'));
				}

				fixed.tfoot.css('overflow-x', 'auto').addClass('ttHScroll');
				fixed.tfootTable.css('width', orgWidth);

			} else {
				fixed.tbody.css('margin-bottom', '0');
				fixed.tfoot.css('overflow-x', 'hidden').removeClass('ttHScroll');
				fixed.parent.css('overflow', 'hidden');
				fixed.tfootTable.css('width', '100%');
			}

			fixed.thead.css('width', resizeWidth);

			if (fixed.orgFoot.length) {
				fixed.tfoot.css('width', resizeWidth);
			} else {
				//No footer
				fixed.tbody.css('overflow-x', 'auto');
				fixed.tbody.scroll({f: fixed.tfoot, h: fixed.thead}, function(e) {
					e.data.h[0].scrollLeft = e.data.f[0].scrollLeft = this.scrollLeft;
				});
			}

			//show header and footer on delay
			fixed.thead.css('visibility', 'visible');
			fixed.tfoot.css('visibility', 'visible');

			// set our column widths using representative cells from every column (fixed.sortHead)
			if (fixed.sortHead) {
				setColWidth(fixed.sortHead, fixed.theadColgroup);
			}
			if (fixed.sortFoot) {
				setColWidth(fixed.sortFoot, fixed.tfootColgroup);
			}
		};

		fixed.touch = function() {
			fixed.tbody.scroll({f: fixed.tfoot}, function(e) {
				e.data.f[0].scrollLeft = this.scrollLeft;
			});
		};

		fixed.wheelScroll = function(e) {
			if (!wheelEvent && e.type === 'wheel') {
				wheelEvent = true;
			}

			if ((wheelEvent && e.type === 'wheel') || (!wheelEvent)) {
				var horWheelData = (e.originalEvent.deltaX || (-(e.originalEvent.wheelDeltaX / 3)));

				if (horWheelData > 0) {
					horWheelData = Math.min(10, horWheelData);
				} else if (horWheelData < 0) {
					horWheelData = Math.max(-10, horWheelData);
				} else {
					horWheelData = 0;
				}

				fixed.tfoot[0].scrollLeft += horWheelData;
			}
		};

		fixed.windowResize = function() {
			fixed.thead.css('visibility', 'hidden');
			fixed.tfoot.css('visibility', 'hidden');
			fixed.parent.css('overflow', 'hidden');
			clearTimeout(timer);
			timer = setTimeout(function() {
				fixed.setHeadHeight();
				scrollTracker(true, fixed.tfoot, fixed.tbody);
			}, 100);
		};

		//default behavior for horizontal scrolling of the footer
		fixed.tfoot.scroll({h: fixed.tbody, f: fixed.thead}, function(e) {
			e.data.h[0].scrollLeft = e.data.f[0].scrollLeft = this.scrollLeft;
		});

		//needed for windows phones
		fixed.tbody.scroll({f: fixed.tfoot}, function(e) {
			e.data.f[0].scrollLeft = this.scrollLeft;

			//Add class to tbody when scrollbar is at the top or bottom of the table
			if (this.scrollTop === 0) {
				fixed.thead.addClass('atTop');
				fixed.tfoot.removeClass('atBottom');
			} else if (Math.round(this.scrollHeight - this.scrollTop) === Math.round(this.clientHeight)) {
				fixed.thead.removeClass('atTop');
				fixed.tfoot.addClass('atBottom');
			} else {
				fixed.thead.removeClass('atTop');
				fixed.tfoot.removeClass('atBottom');
			}
		});

		//horizontal swipe functionality
		fixed.tbody.on('wheel mousewheel', fixed.wheelScroll).on('touchstart', fixed.touch);
		win.resize(fixed.windowResize);
		fixed.windowResize();
		scrollTracker(null, fixed.tfoot, fixed.tbody);
		allFixed.push(fixed);
	}

	function stickyWrap(table) {
		var colWidth = [],
			sticky = {},
			timer = null,
			scrollPosY;

		sticky.windowResize = function () {

			//If topElement or btmElement (associated with setLimits API call) are set, update on resize.
			if (topElement > 0 || btmElement > 0) {
				setStickyLimits(topEleWrap, btmEleWrap);
			}

			//Hide header and footer on resize
			sticky.thead.css('visibility', 'hidden');
			sticky.tfoot.css('visibility', 'hidden');

			clearTimeout(timer);
			timer = setTimeout(function() {
				var maxWidth = sticky.tbody.width(),
					orgHeadHeight = sticky.orgHead.height(),
					maxHeight = sticky.tbody.height(),
					rowHeight = sticky.firstRow.height(),
					orgWidth = sticky.table.width(),
					resizeWidth = sticky.tbody.width();

				//accomidate for tables with large headers and footers
				if (resizeWidth < orgWidth) {
					sticky.tfootInner.css('overflow-x', 'auto');
					sticky.tfootTable.css('width', orgWidth);
					sticky.tbody.css('padding-bottom', getScrollbarWidth('outer'));
					sticky.theadTable.css('min-width', orgWidth);

					//if no footer, give footer height for scrollbar
					if (parseInt(sticky.tfootTable.css('height')) === 0) {
						sticky.tfootTable.css('height', '1px');
					}

				} else {
					sticky.tbody.css('padding-bottom', '0');
					sticky.tfootInner.css('overflow-x', 'hidden');
					sticky.tfootTable.css('width', '100%');
				}

				//run by default
				sticky.theadInner.css('max-width', maxWidth);
				sticky.tfootInner.css('max-width', maxWidth);

				//show header and footer on delay
				sticky.thead.css('visibility', 'visible');
				sticky.tfoot.css('visibility', 'visible');
				sticky.setStickies();

				if (sticky.sortHead) {
					setColWidth(sticky.sortHead, sticky.theadColgroup);
				}

				if (sticky.sortFoot) {
					setColWidth(sticky.sortFoot, sticky.tfootColgroup);
				}

				scrollTracker(true, sticky.tfootInner, sticky.tbody); // do not attach scroll evt listener
			}, 100);
		};

		sticky.setStickies = function() {
			scrollPosY = document.body.scrollTop;

			//scrollbar Y location
			var yBar = window.scrollY || document.documentElement.scrollTop,
			//window height
			windowHeight = win.height(),

			//set this to other fixed elements on page (ie: wc header)
			thisTable = sticky.parent,
			tableHeight = sticky.parent.height(),
			footHeight = sticky.tfoot.outerHeight(),
			headHeight = sticky.thead.outerHeight(),
			tblOffset = sticky.parent.offset().top,
			tblBottom = tblOffset + sticky.parent.outerHeight(),
			bodyScroll = (window.pageXOffset !== undefined) ? window.pageXOffset : (document.documentElement || document.body.parentNode || document.body).scrollLeft,
			hstyle = sticky.thead[0].style,
			fstyle = sticky.tfoot[0].style;

			//Update the setStickies values on resize
			topElement = topElement ? topElement : 0;
			btmElement = btmElement ? btmElement : 0;

			//Header and footer scroll with the body but default margin left is 0
			if (tblBottom - headHeight - footHeight - yBar <= topElement) {
				sticky.thead.removeClass('isStuck');
				hstyle.position = "absolute";
				hstyle.top = "auto";
				hstyle.bottom = footHeight + "px";
				hstyle.marginLeft = "0px";
			} else if (tblOffset - yBar <= topElement) {
				if (windowHeight > headHeight + footHeight + 40) {
					sticky.thead.addClass('isStuck');
					hstyle.position = "fixed";
					hstyle.top = topElement + "px";
					hstyle.bottom = "auto";
					hstyle.marginLeft = -bodyScroll + "px";
				}
			} else {
				sticky.thead.removeClass('isStuck');
				hstyle.position = "absolute";
				hstyle.top = 0;
				hstyle.bottom = "auto";
				hstyle.marginLeft = "0px";
			}

			//set footer sticky threshold
			if (tblOffset + headHeight + footHeight - yBar >= windowHeight - btmElement) {
				sticky.tfoot.removeClass('isStuck');
				fstyle.position = "absolute";
				fstyle.bottom = "auto";
				fstyle.top = headHeight + "px";
				fstyle.marginLeft = "0px";
			} else if (tblBottom - yBar <= windowHeight - btmElement) {
				sticky.tfoot.removeClass('isStuck');
				fstyle.position = "absolute";
				fstyle.top = "auto";
				fstyle.bottom = 0;
				fstyle.marginLeft = "0px";
			} else {
				if (windowHeight > headHeight + footHeight + 40) {
					sticky.tfoot.addClass('isStuck');
					fstyle.position = "fixed";
					fstyle.top = "auto";
					fstyle.bottom = btmElement + "px";
					fstyle.marginLeft = "-" + bodyScroll + "px";
				}
			}
		};

		sticky.touch = function(e) {
			sticky.tbody.scroll({f: sticky.tfootInner}, function(e) {
				e.data.f[0].scrollLeft = this.scrollLeft;
			});
		};

		sticky.wheelScroll = function(e) {
			var horWheelData = (e.deltaX || (-(e.wheelDeltaX / 3)));

				if (horWheelData > 0) {
					horWheelData = Math.min(10, horWheelData);
				}
				else if (horWheelData < 0) {
					horWheelData = Math.max(-10, horWheelData);
				}
				else {
					horWheelData = 0;
				}

			sticky.tfootInner[0].scrollLeft += horWheelData;
		};

		sticky.parent = j('<div class="tabletool ttsticky"></div>');
		sticky.table = j(table);

		//remove data attribute from original table
		sticky.table.removeAttr('data-tttype');
		sticky.table.wrap(sticky.parent);

		//set parent var to $jquery object for future reference
		sticky.parent = sticky.table.parent();
		sticky.table.wrap('<div class="outer"><div class="inner"></div></div>');

		// //declare wrapping div elements
		sticky.tbody = sticky.table.parents('.outer');
		sticky.tfoot = sticky.tbody.clone(true).addClass('tfoot').attr('aria-hidden', 'true').appendTo(sticky.parent);
		sticky.thead = sticky.tbody.clone(true).addClass('thead').attr('aria-hidden', 'true').appendTo(sticky.parent);

		// give cloned header and footer unique IDs. Wait until after append complete
		uniqueIDs(sticky.thead, sticky.tfoot);

		sticky.tbody.addClass('tbody');
		sticky.tfootTable = sticky.tfoot.find('table');
		sticky.theadTable = sticky.thead.find('table');
		sticky.tfootTable.removeAttr('id data-ttheight').children('thead, tbody, caption').remove();
		sticky.theadTable.removeAttr('id data-ttheight').children('tfoot, tbody').remove();
		sticky.orgHead = sticky.tbody.find('thead');
		sticky.orgFoot = sticky.tbody.find('tfoot');
		sticky.firstRow = sticky.tbody.find('tbody tr:first-child');
		sticky.tfootInner = sticky.tfoot.find('.inner');
		sticky.theadInner = sticky.thead.find('.inner');
		sticky.sortHead = sticky.orgHead.length ? sortCols(sticky, CONST_THEAD) : false;
		sticky.sortFoot = sticky.orgFoot.length ? sortCols(sticky, CONST_TFOOT) : false;

		//Fieldset elements are useful for organizing and grouping related items within a form.
		//Using fieldsets to contain tables is inappropriate because it complicates styling via css; DIVs should be used instead.
		sticky.parent.parents('fieldset').addClass('ttFieldsetFix');

		//default behavior for horizontal scrolling of the footer
		sticky.tfootInner.scroll({b: sticky.tbody, f: sticky.theadInner}, function(e) {
			e.data.b[0].scrollLeft = e.data.f[0].scrollLeft = this.scrollLeft;
		});

		//on touch set the body scroll to the footer scroll
		if (document.body.addEventListener) {
			//Use vinillaJS event listeners for wheel x data
			var wheelBody = sticky.tbody[0],
				wheelEvents = ['wheel', 'mousewheel'];

			for (var i=0;i<wheelEvents.length;i++) {
				wheelBody.addEventListener(wheelEvents[i], sticky.wheelScroll, false);
			}
		}

		win.scroll(sticky.setStickies).resize(sticky.windowResize);
		sticky.windowResize();
		sticky.setStickies();
		scrollTracker(null, sticky.tfootInner, sticky.tbody); // attach scroll evt listener
		allStickies.push(sticky);
	}

	function sidescrollWrap(table, len) {
		var sidescroll = {},
			parseLen = parseInt(len),
			colInt = (!isNaN(len) && parseLen > 0) ? parseLen : 1,
			colDivideEle = null,
			scrollDly = null,
			resizeDly = null;

		sidescroll.bodyTbl = j(table).removeAttr('data-tttype').wrap('<div class="tabletool ttsidescroll"><div class="scrollbodywrap sideouter"></div></div>');
		sidescroll.bodyWrap = sidescroll.bodyTbl.parents('.scrollbodywrap');
		sidescroll.sidePar = sidescroll.bodyTbl.parents('.ttsidescroll');
		sidescroll.headerTbl = sidescroll.bodyTbl.clone(true).wrap('<div class="scrollheadwrap sideouter"></div>');

		// give cloned header unique IDs. Wait until after wrap complete
		uniqueIDs(sidescroll.headerTbl);
		sidescroll.headerWrap = sidescroll.headerTbl.parent().prependTo(sidescroll.sidePar);
		colDivideEle = sidescroll.bodyTbl.find('tbody > tr:first-child > *:nth-child(' + (colInt + 1) + ')'); // could be either TD or TH immediate children


		sidescroll.clearStyles = function() {
			sidescroll.bodyTbl.css('margin-left', '');
			sidescroll.headerWrap.css({'max-width': '', 'display': ''});
		};

		sidescroll.sizeSidescroll = function() {
			var divideLine = colDivideEle.position().left,
				parWidth = widthCalc(sidescroll.sidePar);

			function resetSideTbl() {
				sidescroll.bodyTbl.css('margin-left', '');
				sidescroll.headerWrap.css('display', 'none');
			}

			if (divideLine < (parWidth / 2)) { // header column wrapper is < 50% of parent ttsidescroll wrapper
				sidescroll.bodyTbl.css('margin-left', -divideLine);
				sidescroll.headerWrap.css({'max-width': divideLine, 'display': ''});

				if (parWidth > widthCalc(sidescroll.bodyTbl)) {  // ttsidescroll wrapper is narrower then body table
					resetSideTbl(); // reset sidescroll to default table behavior
				}
			} else { // header column wrapper is >= 50% of parent ttsidescroll wrapper
				resetSideTbl();
			}
		};

		sidescroll.resize = function() {
			clearTimeout(resizeDly);
			resizeDly = setTimeout(function() {
				scrollTracker(true, sidescroll.bodyWrap); // don't attach scroll evt listenerw positions
			}, 100);

			sidescroll.sizeSidescroll(); // need to re-evaluate on each resize event
		}

		function rmvRowCls(cls) {
			j.each(allSidescrolls, function(idx, ele) {
				j(ele.sidePar).find('tr').removeClass(cls);
			});
		}

		function linkRowEvt(currRow, lnkCls) {
			var currTar = j(currRow.currentTarget);

			j(currRow.delegateTarget)
				.find(
					currTar.parent()[0].tagName + ' tr:nth-child(' + (currTar.index() + 1) + ')'
				)
				.addClass(lnkCls);
		}

		// pass focus, active and hover events from body sidescroll table to header table and vise versa.
		sidescroll.sidePar.on('mouseenter mouseleave mousedown mouseup focus blur', 'tr', function(hEvt) {
			switch(hEvt.type) {
				case 'mouseleave':
					rmvRowCls('hover');
					break;
				case 'mouseenter':
					rmvRowCls('hover');
					linkRowEvt(hEvt, 'hover');
					break;
				case 'focusout':
					rmvRowCls('focus');
					break;
				case 'focusin':
					rmvRowCls('focus');
					linkRowEvt(hEvt, 'focus');
					break;
				case 'mouseup':
					rmvRowCls('active');
					break;
				case 'mousedown':
					rmvRowCls('active');
					linkRowEvt(hEvt, 'active');
					break;
			}
		});

		win.resize(sidescroll.resize);
		sidescroll.resize();
		sidescroll.sizeSidescroll(); // position elements on load
		setTimeout(sidescroll.sizeSidescroll, 100); // once elements are positioned, remeasure in their new positions
		scrollTracker(null, sidescroll.bodyWrap); // attach scroll evt listenerw positions
		allSidescrolls.push(sidescroll);
	}

	function setColWidth(sortedColAry, newColgroup) {
		var sortedLen = sortedColAry.length;

		// Assign widths to our colgroup cols
		j(sortedColAry).each(function(idx, colRep) {
			var colgroupEle = (newColgroup[idx] && newColgroup[idx].tagName.toLowerCase() === 'col') ? j(newColgroup[idx]) : j('<col>').appendTo(newColgroup);

			if (colRep) {
				var sortedColEle = j(colRep.colEle || colRep),
					curColleftPos = sortedColEle.position().left,
					nxtColLftPos = null,
					nxtRep = null,
					nxt = 1;

				//Some columns are undefined when they don't have a representative cell,
				//skip to the next column to grap a next col left point
				while (nxt < sortedLen - idx && nxtColLftPos === null) {
					nxtRep = sortedColAry[idx + nxt];

					nxtColLftPos = nxtRep ? j(nxtRep.colEle || nxtRep).position().left : null;
					nxt++;
				}

				//If columns are split and not represented by a single cell,
				//subtract the left points of the current column representative from the next column left value and assign it to our col tag
 				if (nxtColLftPos && curColleftPos + widthCalc(sortedColEle) > nxtColLftPos) {
					colgroupEle.css('width', nxtColLftPos - curColleftPos);
				} else {
					colgroupEle.css('width', widthCalc(sortedColEle));
				}
			}
		});
	}

	function sortCols(ttObj, contextEle) {
		var allRows = ttObj.tbody.find('table tr'),
			contextBar = contextEle === CONST_THEAD ? ttObj.thead : ttObj.tfoot,
			theadMatrix = allRows.map(function() {return j(this).children()}),
			colReps = [],
			colLength = null,
			colspanMatrix = [],
			preExistingCols = contextBar.find('colgroup'),
			colgroupClone = preExistingCols.length ? preExistingCols : j('<colgroup></colgroup>').prependTo(contextBar.find('table')),
			colgroupChildren = colgroupClone.children();

		function countColspans(e) {
			var t = 0;

			j(e).each(function(e, n){
				t += parseInt(j(n).attr('colspan')) || 1;
			});

			return t;
		}

		colLength = countColspans(theadMatrix[0]);

		for (var i=0; i<theadMatrix.length; i++) {
			var rowspanAry = [],
				curRow = theadMatrix[i],
				countAry = [],
				colspanCount = 1;

			//Loop through every possible column
			for (var colIdx=0; colIdx<colLength; colIdx++) {
				var prevRow = colspanMatrix[i-1];

				//Rows inheriting rowspanned ancestor cells will also be in the same column
				// Inject columns (from ancestor rows) if present
				if (prevRow) {
					var prvIdx = prevRow.indexOfObject('colCount', colspanCount);

					if (prevRow[prvIdx] && prevRow[prvIdx].rowspanVal > 1) {
						var sib = 1,
							prvRwspnEle = prevRow[prvIdx],
							prvColspanVal = prvRwspnEle.colspanVal,
							colSpaceObj = {
								'colCount' : prvRwspnEle.colCount,
								'rowspanVal' : prvRwspnEle.rowspanVal - 1,
								'colspanVal' : prvColspanVal,
								'colEle' : prvRwspnEle
							};

						rowspanAry.push(colSpaceObj);
						colspanCount += prvColspanVal;

						// Use updated colspanCount to try and locate the next element
						while (prevRow[prvIdx + sib] && prevRow[prvIdx + sib].rowspanVal > 1) {
							var nextRowspan = prevRow[prvIdx + sib],
								sibColspnVal = nextRowspan.colspanVal,
								sibSpaceObj = {
									'colCount' : nextRowspan.colCount,
									'rowspanVal' : nextRowspan.rowspanVal - 1,
									'colspanVal' : sibColspnVal,
									'colEle' : nextRowspan
								};

							rowspanAry.push(sibSpaceObj);
							colspanCount += sibColspnVal;
							sib++;
						}
					}
				}

				if (curRow[colIdx]) {
					var th = j(curRow[colIdx]),
						colspanValVar = parseInt(th.attr('colspan')) || 1,
						rowspanValVar = parseInt(th.attr('rowspan')) || 1,
						rowspanObj = {
							'colCount' : colspanCount,
							'rowspanVal' : rowspanValVar,
							'colspanVal' : colspanValVar,
							'colEle' : th
						};

					rowspanAry.push(rowspanObj)
					colspanCount += colspanValVar;
				}

				// The array is getting sorted and we are figuring out which cells in each column have the smallest colspan value
				if (colReps[colIdx]) {
					var prevSortedEle = colspanMatrix[i - 1][colspanMatrix[i - 1].indexOfObject('colCount', colIdx + 1)],
						curEle = rowspanAry[rowspanAry.indexOfObject('colCount', colIdx + 1)];

					if (prevSortedEle && i === 1) {
						colReps[colIdx] = prevSortedEle.colspanVal < colReps[colIdx].colspanVal ? prevSortedEle : colReps[colIdx];
					}

					if (curEle) {
						colReps[colIdx] = curEle.colspanVal < colReps[colIdx].colspanVal ? curEle : colReps[colIdx];
					}
				}

				else {
					colReps[colIdx] = rowspanAry[rowspanAry.indexOfObject('colCount', colIdx + 1)];
				}

				if (!colgroupChildren[colIdx]) {
					colgroupChildren[colIdx] = j('<col>').appendTo(colgroupClone);
				}
			}

			colspanMatrix.push(rowspanAry);
		}

		if (contextEle === CONST_THEAD) {
			ttObj.theadColgroup = j(colgroupClone).children();
		} else {
			ttObj.tfootColgroup = j(colgroupClone).children();
		}

		colspanMatrix.length = 0;
		return colReps;
	}

	function setStickyLimits(topEle, btmEle) {
		topEleWrap = j(topEle);
		btmEleWrap = j(btmEle);

		//If called before TableTool is initialized
		if (!win) {
			win = j(window);
		}

		if (topEleWrap.length) {
			topElement = topEleWrap.position().top + topEleWrap.outerHeight();
		} else {
			topElement = 0;
		}
		if (btmEleWrap.length) {
			btmElement = win.height() - btmEleWrap.position().top;
		} else {
			btmElement = 0;
		}

		j(allStickies).each(function (idx, ele) {
		   ele.setStickies();
		});
	}

	function widthCalc(breakJq) {
		var ele = j(breakJq)[0],
			width = null;

		//Use boundingClient for width if possible
		if (ele.getBoundingClientRect && ele.getBoundingClientRect().width) {
			width = ele.getBoundingClientRect().width;
		} else if (ele.offsetWidth) {
			width = ele.offsetWidth;
		} else {
			width = j(ele).width();
		}

		return width;
	}

	Array.prototype.indexOfObject = function(property, value) {
		for (var i = 0, len = this.length; i < len; i++) {
			if (this[i][property] === value) {
				return i;
			}
		}
	};

	// Document Ready/Load
	j(document).ready(init);
	j(window).load(setupDetection);

	//define API
	TableTool.init = init;
	TableTool.setLimits = setStickyLimits;

	TableTool.update = function () {
		TableTool.init();
		//loop through all sticky tables and call windowResize method.
		for (var i=0; i<allStickies.length; i++) {
			allStickies[i].windowResize();
		}

		//loop through all fixed tables and call setHeadHeight method.
		for (var i=0; i<allFixed.length; i++) {
			allFixed[i].setHeadHeight();
		}
	};

	TableTool.disable = function () {
		//loop through all sticky tables, apply "disabled" class to outermost layer.
		for (var i=0; i<allStickies.length; i++) {
			var stickyTable = allStickies[i];

			stickyTable.table
				.clone()
				.attr('data-ttdisabled', 'stickydisabled')
				.insertBefore(stickyTable.parent);

			stickyTable.parent.remove();
		}

		//loop through all fixed tables, apply "disabled" class to outermost layer.
		for (var i=0; i<allFixed.length; i++) {
			var fixedTable = allFixed[i];

			fixedTable.table
				.clone()
				.attr('data-ttdisabled', 'fixeddisabled')
				.insertBefore(fixedTable.parent);

			fixedTable.parent.remove();
		}

		for (var i=0; i<allSidescrolls.length; i++) {
			var sidescroll = allSidescrolls[i];

			sidescroll.clearStyles();
			sidescroll.bodyTbl
				.clone()
				.attr('data-ttdisabled', 'sidescrolldisabled')
				.insertBefore(sidescroll.sidePar);

			sidescroll.sidePar.remove()
		}

		checkTableToolExists();
	};

	TableTool.enable = function () {
		j('table[data-ttdisabled]').each(function(idx, ttd) {
			var tt = j(ttd);

			tt
				.attr('data-tttype', tt.data('ttdisabled').replace('disabled', ''))
				.removeAttr('data-ttdisabled');
		});

		TableTool.update();
	};

	TableTool.convert = function (ele, type, height) {
		j(ele).attr({
			'data-ttType' : type,
			'data-ttHeight' : height
		});

		TableTool.init();
	};

	TableTool.changeHeight = function (ttID, height) {
		//If an id is passed as first parameter, store it or it's ancestor's data-ttid;
		var newHeight = parseInt(height),
			tableID = j(ttID).data('ttid') || j(ttID).parents('.tabletool[data-ttID]').data('ttid');

		for (var i=0;i<allFixed.length;i++) {
			var storedFixed = allFixed[i],
				storedID = j(storedFixed.parent).data('ttid');

			//If the data-ttid value string is passed in the first parameter, compare it with the ttid value of the current table in the loop
			if (storedID == tableID || storedID == ttID) {
				var fixedTbody = j(allFixed[i].tbody);

				if (!j(storedFixed.tfoot).hasClass('ttHScroll')) {
					fixedTbody.css('max-height', newHeight);
				} else {
					fixedTbody.css('max-height', newHeight - getScrollbarWidth('ttfixed'));
				}

				storedFixed.setHeadHeight();
			}
		}
	};

})(jQuery);
