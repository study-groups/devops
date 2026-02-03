/**
 * spandoc.js - SpaCy-style span annotation engine for terrain templates
 *
 * Discovers text in DOM, tokenizes it, manages layered span annotations
 * (timing, voice, emphasis, entity). Uses Range API for non-destructive wrapping.
 *
 * Model: Doc contains tokens (words with char offsets) and named span groups.
 * Span groups coexist over the same text (timing, voice, emphasis, entity).
 */
(function() {
    'use strict';

    // ---------------------------------------------------------------
    // Tokenizer — split text into tokens with char offsets
    // ---------------------------------------------------------------

    function tokenize(text) {
        var tokens = [];
        var re = /(\S+)(\s*)/g;
        var m;
        var i = 0;
        while ((m = re.exec(text)) !== null) {
            tokens.push({
                i: i,
                text: m[1],
                start: m.index,
                end: m.index + m[1].length,
                ws: m[2]
            });
            i++;
        }
        return tokens;
    }

    // ---------------------------------------------------------------
    // Doc — token array + span groups + render/destroy
    // ---------------------------------------------------------------

    function Doc(element, tokens) {
        this.element = element;
        this.tokens = tokens;
        this.spans = {};        // {groupName: [Span, ...]}
        this._original = null;  // saved innerHTML for destroy
        this._rendered = false;
        this._audio = null;
        this._onTimeUpdate = null;
    }

    Doc.prototype.addSpan = function(group, start, end, label, attrs) {
        if (!this.spans[group]) this.spans[group] = [];
        this.spans[group].push({
            group: group,
            start: start,
            end: end,
            label: label || '',
            attrs: attrs || {}
        });
    };

    Doc.prototype.addSpans = function(group, spanArr) {
        for (var i = 0; i < spanArr.length; i++) {
            var s = spanArr[i];
            this.addSpan(group, s.start, s.end, s.label, s.attrs);
        }
    };

    // Map token char offsets to text node positions
    function buildTextNodeMap(element) {
        var map = []; // [{node, offset, length}]
        var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        var charPos = 0;
        var node;
        while ((node = walker.nextNode())) {
            map.push({ node: node, offset: charPos, length: node.length });
            charPos += node.length;
        }
        return map;
    }

    function findTextPosition(nodeMap, charOffset) {
        for (var i = 0; i < nodeMap.length; i++) {
            var entry = nodeMap[i];
            if (charOffset >= entry.offset && charOffset <= entry.offset + entry.length) {
                return { node: entry.node, offset: charOffset - entry.offset };
            }
        }
        // Fallback to last node end
        if (nodeMap.length > 0) {
            var last = nodeMap[nodeMap.length - 1];
            return { node: last.node, offset: last.length };
        }
        return null;
    }

    // Priority order for rendering (lower = rendered first, ends up outermost)
    var GROUP_PRIORITY = { entity: 0, emphasis: 1, voice: 2, timing: 3 };

    Doc.prototype.render = function() {
        if (this._rendered) this.destroy();
        this._original = this.element.innerHTML;
        this._rendered = true;

        // Collect all spans, sort by priority then by span length (longer first)
        var allSpans = [];
        var groups = Object.keys(this.spans);
        for (var g = 0; g < groups.length; g++) {
            var groupName = groups[g];
            var groupSpans = this.spans[groupName];
            for (var s = 0; s < groupSpans.length; s++) {
                allSpans.push(groupSpans[s]);
            }
        }

        allSpans.sort(function(a, b) {
            var pa = GROUP_PRIORITY[a.group] !== undefined ? GROUP_PRIORITY[a.group] : 5;
            var pb = GROUP_PRIORITY[b.group] !== undefined ? GROUP_PRIORITY[b.group] : 5;
            if (pa !== pb) return pa - pb;
            // Longer spans first (they become outer wrappers)
            return (b.end - b.start) - (a.end - a.start);
        });

        var tokens = this.tokens;

        for (var i = 0; i < allSpans.length; i++) {
            var span = allSpans[i];
            var startToken = tokens[span.start];
            var endToken = tokens[Math.min(span.end, tokens.length) - 1];
            if (!startToken || !endToken) continue;

            var nodeMap = buildTextNodeMap(this.element);
            var startPos = findTextPosition(nodeMap, startToken.start);
            var endPos = findTextPosition(nodeMap, endToken.end);
            if (!startPos || !endPos) continue;

            try {
                var range = document.createRange();
                range.setStart(startPos.node, startPos.offset);
                range.setEnd(endPos.node, endPos.offset);

                var wrapper = document.createElement('span');
                wrapper.className = 'sd-' + span.group;
                wrapper.setAttribute('data-sd-group', span.group);
                if (span.label) {
                    wrapper.setAttribute('data-sd-label', span.label);
                    wrapper.classList.add('sd-' + span.group + '-' + span.label);
                }
                wrapper.setAttribute('data-sd-start', span.start);
                wrapper.setAttribute('data-sd-end', span.end);

                // Group-specific attrs as data attributes
                if (span.attrs) {
                    var keys = Object.keys(span.attrs);
                    for (var k = 0; k < keys.length; k++) {
                        wrapper.setAttribute('data-sd-' + keys[k], span.attrs[keys[k]]);
                    }
                }

                // Custom property for emphasis fx
                if (span.group === 'emphasis' && span.attrs && span.attrs.fx) {
                    wrapper.style.setProperty('--fx', span.attrs.fx);
                    wrapper.classList.add('sd-fx-' + span.attrs.fx);
                }

                // Timing spans get duration custom property
                if (span.group === 'timing' && span.attrs && span.attrs.t0 !== undefined) {
                    var dur = (span.attrs.t1 - span.attrs.t0).toFixed(2);
                    wrapper.style.setProperty('--anim-dur', dur + 's');
                }

                range.surroundContents(wrapper);
            } catch (e) {
                // surroundContents fails on partial node boundaries;
                // fall back to extractContents + wrap
                try {
                    var range2 = document.createRange();
                    var nodeMap2 = buildTextNodeMap(this.element);
                    var sp2 = findTextPosition(nodeMap2, startToken.start);
                    var ep2 = findTextPosition(nodeMap2, endToken.end);
                    if (!sp2 || !ep2) continue;
                    range2.setStart(sp2.node, sp2.offset);
                    range2.setEnd(ep2.node, ep2.offset);

                    var frag = range2.extractContents();
                    var wrapper2 = document.createElement('span');
                    wrapper2.className = 'sd-' + span.group;
                    wrapper2.setAttribute('data-sd-group', span.group);
                    if (span.label) {
                        wrapper2.setAttribute('data-sd-label', span.label);
                        wrapper2.classList.add('sd-' + span.group + '-' + span.label);
                    }
                    wrapper2.setAttribute('data-sd-start', span.start);
                    wrapper2.setAttribute('data-sd-end', span.end);
                    if (span.attrs) {
                        var keys2 = Object.keys(span.attrs);
                        for (var k2 = 0; k2 < keys2.length; k2++) {
                            wrapper2.setAttribute('data-sd-' + keys2[k2], span.attrs[keys2[k2]]);
                        }
                    }
                    if (span.group === 'emphasis' && span.attrs && span.attrs.fx) {
                        wrapper2.style.setProperty('--fx', span.attrs.fx);
                        wrapper2.classList.add('sd-fx-' + span.attrs.fx);
                    }
                    if (span.group === 'timing' && span.attrs && span.attrs.t0 !== undefined) {
                        var dur2 = (span.attrs.t1 - span.attrs.t0).toFixed(2);
                        wrapper2.style.setProperty('--anim-dur', dur2 + 's');
                    }
                    wrapper2.appendChild(frag);
                    range2.insertNode(wrapper2);
                } catch (e2) {
                    // Skip this span if wrapping fails completely
                }
            }
        }
    };

    Doc.prototype.destroy = function() {
        if (this._original !== null) {
            this.element.innerHTML = this._original;
            this._original = null;
        }
        this._rendered = false;
        this._stopTiming();
    };

    // ---------------------------------------------------------------
    // Timing playback — toggle .sd-active on timing spans
    // ---------------------------------------------------------------

    Doc.prototype.bindAudio = function(audioEl) {
        this._stopTiming();
        this._audio = audioEl;
        if (!audioEl) return;
        var self = this;
        this._onTimeUpdate = function() {
            self._updateTiming();
        };
        audioEl.addEventListener('timeupdate', this._onTimeUpdate);
    };

    Doc.prototype._stopTiming = function() {
        if (this._audio && this._onTimeUpdate) {
            this._audio.removeEventListener('timeupdate', this._onTimeUpdate);
        }
        this._audio = null;
        this._onTimeUpdate = null;
    };

    Doc.prototype._updateTiming = function() {
        if (!this._audio) return;
        var t = this._audio.currentTime;
        var timingEls = this.element.querySelectorAll('.sd-timing');
        for (var i = 0; i < timingEls.length; i++) {
            var el = timingEls[i];
            var t0 = parseFloat(el.getAttribute('data-sd-t0'));
            var t1 = parseFloat(el.getAttribute('data-sd-t1'));
            if (t >= t0 && t < t1) {
                el.classList.add('sd-active');
            } else {
                el.classList.remove('sd-active');
            }
        }
    };

    Doc.prototype.play = function() {
        if (this._audio) this._audio.play();
    };

    Doc.prototype.pause = function() {
        if (this._audio) this._audio.pause();
    };

    Doc.prototype.seek = function(time) {
        if (this._audio) {
            this._audio.currentTime = time;
            this._updateTiming();
        }
    };

    // ---------------------------------------------------------------
    // SpanDoc — static API
    // ---------------------------------------------------------------

    var _docs = [];

    var SpanDoc = {
        /**
         * Create a Doc from a DOM element.
         */
        from: function(element) {
            var text = element.textContent;
            var tokens = tokenize(text);
            var doc = new Doc(element, tokens);
            _docs.push(doc);
            return doc;
        },

        /**
         * Scan a root element for content, return array of Docs.
         * Uses standard selectors that work across terrain templates.
         */
        scan: function(root, selector) {
            root = root || document.body;
            if (!selector) {
                // Auto-detect template type
                var active = root.querySelector('.step.active');
                if (active) {
                    selector = '.step.active p, .step.active li, .step.active h2';
                } else if (root.querySelector('.topic')) {
                    selector = '.topic p, .topic li, .topic h3';
                } else if (root.querySelector('section')) {
                    selector = 'section p, section li, section h2';
                } else {
                    selector = '[data-spandoc], p, h1, h2, h3, h4, h5, h6, li';
                }
            }
            var elements = root.querySelectorAll(selector);
            var docs = [];
            for (var i = 0; i < elements.length; i++) {
                docs.push(SpanDoc.from(elements[i]));
            }
            return docs;
        },

        /**
         * Convert legacy timeline cues [{text, start, end, fx}]
         * to SpanDoc timing spans by matching text to token indices.
         */
        fromCues: function(doc, cues) {
            var tokens = doc.tokens;
            var tokenIdx = 0;
            for (var i = 0; i < cues.length; i++) {
                var cue = cues[i];
                var words = cue.text.split(/\s+/);
                // Find start token matching first word
                var startIdx = -1;
                for (var t = tokenIdx; t < tokens.length; t++) {
                    if (tokens[t].text === words[0]) {
                        startIdx = t;
                        break;
                    }
                }
                if (startIdx === -1) continue;

                var endIdx = startIdx + words.length;
                doc.addSpan('timing', startIdx, endIdx, '', {
                    t0: cue.start,
                    t1: cue.end
                });

                // Also add emphasis if fx is specified and not default highlight
                if (cue.fx && cue.fx !== 'highlight') {
                    doc.addSpan('emphasis', startIdx, endIdx, cue.fx, {
                        fx: cue.fx
                    });
                }

                tokenIdx = endIdx;
            }
        },

        /**
         * Destroy all tracked docs, restore original DOM.
         */
        destroyAll: function() {
            for (var i = _docs.length - 1; i >= 0; i--) {
                _docs[i].destroy();
            }
            _docs = [];
        },

        /** Access tracked docs */
        docs: _docs
    };

    // ---------------------------------------------------------------
    // Director audio element (shared with AnimEngine compat)
    // ---------------------------------------------------------------

    var _directorAudio = null;

    function getDirectorAudio(src) {
        if (!_directorAudio) {
            _directorAudio = document.createElement('audio');
            _directorAudio.style.display = 'none';
            document.body.appendChild(_directorAudio);
        }
        if (src && _directorAudio.getAttribute('src') !== src) {
            _directorAudio.src = src;
        }
        return _directorAudio;
    }

    // ---------------------------------------------------------------
    // PostMessage handlers
    // ---------------------------------------------------------------

    window.addEventListener('message', function(e) {
        var msg = e.data;
        if (!msg || typeof msg !== 'object') return;

        // Native spandoc protocol
        if (msg.type === 'spandoc-init') {
            SpanDoc.destroyAll();
            var elements = msg.elements || [];
            for (var i = 0; i < elements.length; i++) {
                var spec = elements[i];
                var el = document.querySelector(spec.selector);
                if (!el) continue;
                var doc = SpanDoc.from(el);
                var groups = spec.spans || {};
                var groupNames = Object.keys(groups);
                for (var g = 0; g < groupNames.length; g++) {
                    doc.addSpans(groupNames[g], groups[groupNames[g]]);
                }
                doc.render();
                if (spec.spans && spec.spans.timing) {
                    var audioEl = msg.audioSrc ? getDirectorAudio(msg.audioSrc) : null;
                    if (audioEl) doc.bindAudio(audioEl);
                }
            }
        }
        else if (msg.type === 'spandoc-play') {
            if (msg.audioSrc) getDirectorAudio(msg.audioSrc);
            for (var p = 0; p < _docs.length; p++) {
                _docs[p].play();
            }
        }
        else if (msg.type === 'spandoc-pause') {
            for (var q = 0; q < _docs.length; q++) {
                _docs[q].pause();
            }
        }
        else if (msg.type === 'spandoc-seek' && typeof msg.time === 'number') {
            for (var r = 0; r < _docs.length; r++) {
                _docs[r].seek(msg.time);
            }
        }

        // Backwards compatibility: translate anim-init → spandoc
        else if (msg.type === 'anim-init') {
            SpanDoc.destroyAll();
            var cues = msg.cues || [];
            var narration = msg.narration || '';
            var audioSrc = msg.audioSrc || '';
            var audioEl = audioSrc ? getDirectorAudio(audioSrc) : null;

            // Find target paragraph
            var target = null;
            if (narration) {
                var paras = document.querySelectorAll('p');
                for (var j = 0; j < paras.length; j++) {
                    if (paras[j].textContent.trim() === narration.trim()) {
                        target = paras[j];
                        break;
                    }
                }
            }
            if (!target) {
                target = document.querySelector('.step.active p') || document.querySelector('p');
            }
            if (target && cues.length > 0) {
                var doc2 = SpanDoc.from(target);
                SpanDoc.fromCues(doc2, cues);
                doc2.render();
                if (audioEl) doc2.bindAudio(audioEl);
            }
        }
        else if (msg.type === 'anim-play') {
            if (msg.audioSrc) {
                var audio = getDirectorAudio(msg.audioSrc);
                // Bind to first doc if not yet bound
                if (_docs.length > 0 && !_docs[0]._audio) {
                    _docs[0].bindAudio(audio);
                }
                audio.currentTime = 0;
                audio.play();
            }
            for (var ap = 0; ap < _docs.length; ap++) {
                _docs[ap].play();
            }
        }
        else if (msg.type === 'anim-pause') {
            for (var aq = 0; aq < _docs.length; aq++) {
                _docs[aq].pause();
            }
        }
        else if (msg.type === 'anim-seek' && typeof msg.time === 'number') {
            for (var ar = 0; ar < _docs.length; ar++) {
                _docs[ar].seek(msg.time);
            }
        }
    });

    // ---------------------------------------------------------------
    // Expose
    // ---------------------------------------------------------------

    window.SpanDoc = SpanDoc;

})();
