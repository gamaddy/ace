"use strict";

var oop = require("../../lib/oop");
var MixedFoldMode = require("./mixed").FoldMode;
var CstyleFoldMode = require("./cstyle").FoldMode;
var Range = require("../../range").Range;
var TokenIterator = require("../../token_iterator").TokenIterator;


var FoldMode = exports.FoldMode = function () {
    this.cstyleFoldMode = new CstyleFoldMode();
    MixedFoldMode.call(this, this, {
        "js-": new CstyleFoldMode(),
        "css-": new CstyleFoldMode(),
        "php-": this
    });
};

oop.inherits(FoldMode, MixedFoldMode);

(function () {
    this.indentKeywords = {
        "if": 1,
        "while": 1,
        "for": 1,
        "foreach": 1,
        "switch": 1,
        "else": 0,
        "elseif": 0,
        "endif": -1,
        "endwhile": -1,
        "endfor": -1,
        "endforeach": -1,
        "endswitch": -1
    };

    this.foldingStartMarker = /(?:\s|^)(if|else|elseif|while|for|foreach|switch).*\:/i;
    this.foldingStopMarker = /(?:\s|^)(endif|endwhile|endfor|endforeach|endswitch)\;/i;

    this.getFoldWidgetRange = function (session, foldStyle, row) {
        var line = session.doc.getLine(row);
        var match = this.foldingStartMarker.exec(line);
        if (match) {
            return this.phpBlock(session, row, match.index + 2);
        }

        var match = this.foldingStopMarker.exec(line);
        if (match) {
            return this.phpBlock(session, row, match.index + 2);
        }
        return this.cstyleFoldMode.getFoldWidgetRange(session, foldStyle, row);
    };


    // must return "" if there's no fold, to enable caching
    this.getFoldWidget = function (session, foldStyle, row) {
        var line = session.getLine(row);
        var isStart = this.foldingStartMarker.test(line);
        var isEnd = this.foldingStopMarker.test(line);
        if (isStart && !isEnd) {
            var match = this.foldingStartMarker.exec(line);
            var keyword = match && match[1].toLowerCase();
            if (keyword) {
                var type = session.getTokenAt(row, match.index + 2).type;
                if (type == "keyword") {
                    return "start";
                }
            }
        }
        if (isEnd && foldStyle === "markbeginend") {
            var match = this.foldingStopMarker.exec(line);
            var keyword = match && match[1].toLowerCase();
            if (keyword) {
                var type = session.getTokenAt(row, match.index + 2).type;
                if (type == "keyword") {
                    return "end";
                }
            }
        }
        return this.cstyleFoldMode.getFoldWidget(session, foldStyle, row);
    };

    this.phpBlock = function (session, row, column, tokenRange) {
        var stream = new TokenIterator(session, row, column);

        var token = stream.getCurrentToken();
        if (!token || token.type != "keyword") return;

        var val = token.value;
        var stack = [val];
        var dir = this.indentKeywords[val];

        if (val === "else" || val === "elseif") {
            dir = 1;
        }

        if (!dir) return;

        var startColumn = dir === -1 ? stream.getCurrentTokenColumn() : session.getLine(row).length;
        var startRow = row;

        stream.step = dir === -1 ? stream.stepBackward : stream.stepForward;
        while (token = stream.step()) {
            if (token.type !== "keyword") continue;
            var level = dir * this.indentKeywords[token.value];

            if (level > 0) {
                stack.unshift(token.value);
            }
            else if (level <= 0) {
                stack.shift();
                if (!stack.length) break;
                if (level === 0) stack.unshift(token.value);
            }
        }

        if (!token) return null;

        if (tokenRange) return stream.getCurrentTokenRange();

        var row = stream.getCurrentTokenRow();
        if (dir === -1) return new Range(
            row, session.getLine(row).length, startRow, startColumn); else return new Range(
            startRow, startColumn, row, stream.getCurrentTokenColumn());
    };

}).call(FoldMode.prototype);
