/*!
 * by Jason Nelson @iamcarbon;
 * Extended from Hammer.JS - v2.0.8 by Jorik Tangelder; (http://hammerjs.github.io/)
 * Licensed under the MIT license
 */
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var Carbon;
(function (Carbon) {
    var Gestures;
    (function (Gestures) {
        function getTouchActionProps() {
            if (!supportsTouchAction) {
                return false;
            }
            var touchMap = {};
            ['auto', 'manipulation', 'pan-y', 'pan-x', 'pan-x pan-y', 'none'].forEach(function (val) {
                return touchMap[val] = CSS.supports('touch-action', val);
            });
            return touchMap;
        }
        var testElement = document.createElement('div');
        var supportsTouchAction = 'touchAction' in testElement.style;
        var TOUCH_ACTION_MAP = getTouchActionProps();
        var MOBILE_REGEX = /mobile|tablet|ip(ad|hone|od)|android/i;
        Gestures.supportsTouch = 'ontouchstart' in window;
        Gestures.supportsPointerEvents = window['PointerEvent'] !== undefined;
        Gestures.supportsOnlyTouch = Gestures.supportsTouch && MOBILE_REGEX.test(navigator.userAgent);
        var COMPUTE_INTERVAL = 25;
        var INPUT_START = 1;
        var INPUT_MOVE = 2;
        var INPUT_END = 4;
        var INPUT_CANCEL = 8;
        var Direction;
        (function (Direction) {
            Direction[Direction["None"] = 1] = "None";
            Direction[Direction["Left"] = 2] = "Left";
            Direction[Direction["Right"] = 4] = "Right";
            Direction[Direction["Up"] = 8] = "Up";
            Direction[Direction["Down"] = 16] = "Down";
            Direction[Direction["Horizontal"] = 6] = "Horizontal";
            Direction[Direction["Vertical"] = 24] = "Vertical";
            Direction[Direction["All"] = 30] = "All";
        })(Direction = Gestures.Direction || (Gestures.Direction = {}));
        ;
        var PROPS_CLIENT_XY = ['clientX', 'clientY'];
        var State;
        (function (State) {
            State[State["Possible"] = 1] = "Possible";
            State[State["Began"] = 2] = "Began";
            State[State["Changed"] = 4] = "Changed";
            State[State["Ended"] = 8] = "Ended";
            State[State["Recognized"] = 8] = "Recognized";
            State[State["Canceled"] = 16] = "Canceled";
            State[State["Failed"] = 32] = "Failed";
        })(State || (State = {}));
        ;
        var _uniqueId = 1;
        function uniqueId() {
            return _uniqueId++;
        }
        function each(obj, iterator, context) {
            var i = void 0;
            if (!obj)
                return;
            if (obj.forEach) {
                obj.forEach(iterator, context);
            }
            else if (obj.length !== undefined) {
                i = 0;
                while (i < obj.length) {
                    iterator.call(context, obj[i], i, obj);
                    i++;
                }
            }
            else {
                for (i in obj) {
                    obj.hasOwnProperty(i) && iterator.call(context, obj[i], i, obj);
                }
            }
        }
        function mergeOptions(options, defaultOptions) {
            var result = {};
            Object.assign(result, defaultOptions);
            if (options) {
                Object.assign(result, options);
            }
            return result;
        }
        function invokeArrayArg(arg, fn, context) {
            if (Array.isArray(arg)) {
                each(arg, context[fn], context);
                return true;
            }
            return false;
        }
        function inArray(src, find, findByKey) {
            if (src.indexOf && !findByKey) {
                return src.indexOf(find);
            }
            else {
                var i = 0;
                while (i < src.length) {
                    if (findByKey && src[i][findByKey] == find || !findByKey && src[i] === find) {
                        return i;
                    }
                    i++;
                }
                return -1;
            }
        }
        var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
            return typeof obj;
        } : function (obj) {
            return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
        };
        var slicedToArray = function () {
            function sliceIterator(arr, i) {
                var _arr = [];
                var _n = true;
                var _d = false;
                var _e = undefined;
                try {
                    for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
                        _arr.push(_s.value);
                        if (i && _arr.length === i)
                            break;
                    }
                }
                catch (err) {
                    _d = true;
                    _e = err;
                }
                finally {
                    try {
                        if (!_n && _i["return"])
                            _i["return"]();
                    }
                    finally {
                        if (_d)
                            throw _e;
                    }
                }
                return _arr;
            }
            return function (arr, i) {
                if (Array.isArray(arr)) {
                    return arr;
                }
                else if (Symbol.iterator in Object(arr)) {
                    return sliceIterator(arr, i);
                }
                else {
                    throw new TypeError("Invalid attempt to destructure non-iterable instance");
                }
            };
        }();
        function boolOrFn(val, args) {
            if ((typeof val === 'undefined' ? 'undefined' : _typeof(val)) === 'function') {
                return val.apply(args ? args[0] || undefined : undefined, args);
            }
            return val;
        }
        function getRecognizerByNameIfManager(otherRecognizer, recognizer) {
            if (recognizer.manager) {
                return recognizer.manager.get(otherRecognizer);
            }
            return otherRecognizer;
        }
        function stateStr(state) {
            if (state & State.Canceled) {
                return 'cancel';
            }
            else if (state & State.Ended) {
                return 'end';
            }
            else if (state & State.Changed) {
                return 'move';
            }
            else if (state & State.Began) {
                return 'start';
            }
            return '';
        }
        var Recognizer = (function () {
            function Recognizer(options) {
                this.id = uniqueId();
                this.manager = null;
                this.state = State.Possible;
                this.simultaneous = {};
                this.requireFail = [];
                this.options = options;
                this.options.enable = this.options.enable !== false;
            }
            Recognizer.prototype.set = function (options) {
                Object.assign(this.options, options);
                this.manager && this.manager.touchAction.update();
                return this;
            };
            Recognizer.prototype.recognizeWith = function (otherRecognizer) {
                if (invokeArrayArg(otherRecognizer, 'recognizeWith', this)) {
                    return this;
                }
                var simultaneous = this.simultaneous;
                otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
                if (!simultaneous[otherRecognizer.id]) {
                    simultaneous[otherRecognizer.id] = otherRecognizer;
                    otherRecognizer.recognizeWith(this);
                }
                return this;
            };
            Recognizer.prototype.dropRecognizeWith = function (otherRecognizer) {
                if (invokeArrayArg(otherRecognizer, 'dropRecognizeWith', this)) {
                    return this;
                }
                otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
                delete this.simultaneous[otherRecognizer.id];
                return this;
            };
            Recognizer.prototype.requireFailure = function (otherRecognizer) {
                if (invokeArrayArg(otherRecognizer, 'requireFailure', this)) {
                    return this;
                }
                otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
                if (inArray(this.requireFail, otherRecognizer) === -1) {
                    this.requireFail.push(otherRecognizer);
                    otherRecognizer.requireFailure(this);
                }
                return this;
            };
            Recognizer.prototype.dropRequireFailure = function (otherRecognizer) {
                if (invokeArrayArg(otherRecognizer, 'dropRequireFailure', this)) {
                    return this;
                }
                otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
                var index = inArray(this.requireFail, otherRecognizer);
                if (index > -1) {
                    this.requireFail.splice(index, 1);
                }
                return this;
            };
            Recognizer.prototype.hasRequireFailures = function () {
                return this.requireFail.length > 0;
            };
            Recognizer.prototype.canRecognizeWith = function (otherRecognizer) {
                return !!this.simultaneous[otherRecognizer.id];
            };
            Recognizer.prototype.emit = function (input) {
                var state = this.state;
                var base = this;
                function _emit(eventType) {
                    base.manager.emit(eventType, input);
                }
                if (state < State.Ended) {
                    _emit(this.options.event + stateStr(state));
                }
                _emit(this.options.event);
                if (input.additionalEvent) {
                    _emit(input.additionalEvent);
                }
                if (state >= State.Ended) {
                    _emit(this.options.event + stateStr(state));
                }
            };
            Recognizer.prototype.tryEmit = function (input) {
                if (this.canEmit()) {
                    return this.emit(input);
                }
                this.state = State.Failed;
            };
            Recognizer.prototype.canEmit = function () {
                var i = 0;
                while (i < this.requireFail.length) {
                    if (!(this.requireFail[i].state & (State.Failed | State.Possible))) {
                        return false;
                    }
                    i++;
                }
                return true;
            };
            Recognizer.prototype.recognize = function (inputData) {
                var inputDataClone = {};
                Object.assign(inputDataClone, inputData);
                if (!boolOrFn(this.options.enable, [this, inputDataClone])) {
                    this.reset();
                    this.state = State.Failed;
                    return;
                }
                if (this.state & (State.Recognized | State.Canceled | State.Failed)) {
                    this.state = State.Possible;
                }
                this.state = this.process(inputDataClone);
                if (this.state & (State.Began | State.Changed | State.Ended | State.Canceled)) {
                    this.tryEmit(inputDataClone);
                }
            };
            return Recognizer;
        }());
        var AttrRecognizer = (function (_super) {
            __extends(AttrRecognizer, _super);
            function AttrRecognizer(options) {
                return _super.call(this, mergeOptions(options, AttrRecognizer.defaults)) || this;
            }
            AttrRecognizer.prototype.attrTest = function (input) {
                var optionPointers = this.options.pointers;
                return optionPointers === 0 || input.pointers.length === optionPointers;
            };
            AttrRecognizer.prototype.process = function (input) {
                var state = this.state;
                var eventType = input.eventType;
                var isRecognized = state & (State.Began | State.Changed);
                var isValid = this.attrTest(input);
                if (isRecognized && (eventType & INPUT_CANCEL || !isValid)) {
                    return state | State.Canceled;
                }
                else if (isRecognized || isValid) {
                    if (eventType & INPUT_END) {
                        return state | State.Ended;
                    }
                    else if (!(state & State.Began)) {
                        return State.Began;
                    }
                    return state | State.Changed;
                }
                return State.Failed;
            };
            AttrRecognizer.prototype.getTouchAction = function () {
                return [];
            };
            AttrRecognizer.prototype.reset = function () { };
            return AttrRecognizer;
        }(Recognizer));
        AttrRecognizer.defaults = {
            pointers: 1
        };
        var RotateRecognizer = (function (_super) {
            __extends(RotateRecognizer, _super);
            function RotateRecognizer(options) {
                return _super.call(this, mergeOptions(options, RotateRecognizer.defaults)) || this;
            }
            RotateRecognizer.prototype.getTouchAction = function () {
                return ['none'];
            };
            RotateRecognizer.prototype.attrTest = function (input) {
                return _super.prototype.attrTest.call(this, input)
                    && (Math.abs(input.rotation) > this.options.threshold || ((this.state & State.Began)) !== 0);
            };
            RotateRecognizer.prototype.reset = function () { };
            return RotateRecognizer;
        }(AttrRecognizer));
        RotateRecognizer.defaults = {
            event: 'rotate',
            threshold: 0,
            pointers: 2
        };
        var PinchRecognizer = (function (_super) {
            __extends(PinchRecognizer, _super);
            function PinchRecognizer(options) {
                return _super.call(this, mergeOptions(options, PinchRecognizer.defaults)) || this;
            }
            PinchRecognizer.prototype.getTouchAction = function () {
                return ['none'];
            };
            PinchRecognizer.prototype.attrTest = function (input) {
                return _super.prototype.attrTest.call(this, input)
                    && (Math.abs(input.scale - 1) > this.options.threshold || (this.state & State.Began) !== 0);
            };
            PinchRecognizer.prototype.emit = function (input) {
                if (input.scale !== 1) {
                    var inOut = input.scale < 1 ? 'in' : 'out';
                    input.additionalEvent = this.options.event + inOut;
                }
                _super.prototype.emit.call(this, input);
            };
            return PinchRecognizer;
        }(AttrRecognizer));
        PinchRecognizer.defaults = {
            event: 'pinch',
            threshold: 0,
            pointers: 2
        };
        function directionStr(direction) {
            switch (direction) {
                case Direction.Down: return 'down';
                case Direction.Up: return 'up';
                case Direction.Left: return 'left';
                case Direction.Right: return 'right';
                default: return '';
            }
        }
        var PanRecognizer = (function (_super) {
            __extends(PanRecognizer, _super);
            function PanRecognizer(options) {
                var _this = _super.call(this, mergeOptions(options, PanRecognizer.defaults)) || this;
                _this.pX = null;
                _this.pY = null;
                return _this;
            }
            PanRecognizer.prototype.getTouchAction = function () {
                var direction = this.options.direction;
                var actions = [];
                if (direction & Direction.Horizontal) {
                    actions.push('pan-y');
                }
                if (direction & Direction.Vertical) {
                    actions.push('pan-x');
                }
                return actions;
            };
            PanRecognizer.prototype.directionTest = function (input) {
                var options = this.options;
                var hasMoved = true;
                var distance = input.distance;
                var direction = input.direction;
                var x = input.deltaX;
                var y = input.deltaY;
                if (!(direction & options.direction)) {
                    if (options.direction & Direction.Horizontal) {
                        direction = x === 0 ? Direction.None : x < 0 ? Direction.Left : Direction.Right;
                        hasMoved = x !== this.pX;
                        distance = Math.abs(input.deltaX);
                    }
                    else {
                        direction = y === 0 ? Direction.None : y < 0 ? Direction.Up : Direction.Down;
                        hasMoved = y !== this.pY;
                        distance = Math.abs(input.deltaY);
                    }
                }
                input.direction = direction;
                return hasMoved && distance > options.threshold && direction & options.direction;
            };
            PanRecognizer.prototype.attrTest = function (input) {
                return _super.prototype.attrTest.call(this, input) && (this.state & State.Began || !(this.state & State.Began) && this.directionTest(input));
            };
            PanRecognizer.prototype.emit = function (input) {
                this.pX = input.deltaX;
                this.pY = input.deltaY;
                var direction = directionStr(input.direction);
                if (direction) {
                    input.additionalEvent = this.options.event + direction;
                }
                _super.prototype.emit.call(this, input);
            };
            return PanRecognizer;
        }(AttrRecognizer));
        PanRecognizer.defaults = {
            event: 'pan',
            threshold: 10,
            pointers: 1,
            direction: Direction.All
        };
        var SwipeRecognizer = (function (_super) {
            __extends(SwipeRecognizer, _super);
            function SwipeRecognizer(options) {
                return _super.call(this, mergeOptions(options, SwipeRecognizer.defaults)) || this;
            }
            SwipeRecognizer.prototype.getTouchAction = function () {
                return PanRecognizer.prototype.getTouchAction.call(this);
            };
            SwipeRecognizer.prototype.attrTest = function (input) {
                var direction = this.options.direction;
                var velocity = void 0;
                if (direction & (Direction.Horizontal | Direction.Vertical)) {
                    velocity = input.overallVelocity;
                }
                else if (direction & Direction.Horizontal) {
                    velocity = input.overallVelocityX;
                }
                else if (direction & Direction.Vertical) {
                    velocity = input.overallVelocityY;
                }
                return _super.prototype.attrTest.call(this, input)
                    && direction & input.offsetDirection && input.distance > this.options.threshold
                    && input.maxPointers === this.options.pointers
                    && Math.abs(velocity) > this.options.velocity
                    && ((input.eventType & INPUT_END) !== 0);
            };
            SwipeRecognizer.prototype.emit = function (input) {
                var direction = directionStr(input.offsetDirection);
                if (direction) {
                    this.manager.emit(this.options.event + direction, input);
                }
                this.manager.emit(this.options.event, input);
            };
            return SwipeRecognizer;
        }(AttrRecognizer));
        SwipeRecognizer.defaults = {
            event: 'swipe',
            threshold: 10,
            velocity: 0.3,
            direction: Direction.Horizontal | Direction.Vertical,
            pointers: 1
        };
        function bindFn(fn, context) {
            return function boundFn() {
                return fn.apply(context, arguments);
            };
        }
        function setTimeoutContext(fn, timeout, context) {
            return setTimeout(bindFn(fn, context), timeout);
        }
        function getDistance(p1, p2, props) {
            if (!props) {
                props = ['x', 'y'];
            }
            var x = p2[props[0]] - p1[props[0]];
            var y = p2[props[1]] - p1[props[1]];
            return Math.sqrt(x * x + y * y);
        }
        var TapRecognizer = (function (_super) {
            __extends(TapRecognizer, _super);
            function TapRecognizer(options) {
                var _this = _super.call(this, mergeOptions(options, TapRecognizer.defaults)) || this;
                _this.count = 0;
                _this.pTime = 0;
                _this.pCenter = { x: 0, y: 0 };
                _this._timer = null;
                _this._input = null;
                return _this;
            }
            TapRecognizer.prototype.getTouchAction = function () {
                return ['manipulation'];
            };
            TapRecognizer.prototype.process = function (input) {
                var validPointers = input.pointers.length === this.options.pointers;
                var validMovement = input.distance < this.options.threshold;
                var validTouchTime = input.deltaTime < this.options.time;
                this.reset();
                if (input.eventType & INPUT_START && this.count === 0) {
                    return this.failTimeout();
                }
                if (validMovement && validTouchTime && validPointers) {
                    if (input.eventType !== INPUT_END) {
                        return this.failTimeout();
                    }
                    var validInterval = this.pTime ? input.timeStamp - this.pTime < this.options.interval : true;
                    var validMultiTap = !this.pCenter || getDistance(this.pCenter, input.center) < this.options.posThreshold;
                    this.pTime = input.timeStamp;
                    this.pCenter = input.center;
                    if (!validMultiTap || !validInterval) {
                        this.count = 1;
                    }
                    else {
                        this.count += 1;
                    }
                    this._input = input;
                    var tapCount = this.count % this.options.taps;
                    if (tapCount === 0) {
                        if (!this.hasRequireFailures()) {
                            return State.Recognized;
                        }
                        else {
                            this._timer = setTimeoutContext(function () {
                                this.state = State.Recognized;
                                this.tryEmit();
                            }, this.options.interval, this);
                            return State.Began;
                        }
                    }
                }
                return State.Failed;
            };
            TapRecognizer.prototype.failTimeout = function () {
                var _this = this;
                this._timer = setTimeoutContext(function () {
                    _this.state = State.Failed;
                }, this.options.interval, this);
                return State.Failed;
            };
            TapRecognizer.prototype.reset = function () {
                clearTimeout(this._timer);
            };
            TapRecognizer.prototype.emit = function () {
                if (this.state === State.Recognized) {
                    this._input.tapCount = this.count;
                    this.manager.emit(this.options.event, this._input);
                }
            };
            return TapRecognizer;
        }(Recognizer));
        TapRecognizer.defaults = {
            event: 'tap',
            pointers: 1,
            taps: 1,
            interval: 300,
            time: 250,
            threshold: 9,
            posThreshold: 10
        };
        var PressRecognizer = (function (_super) {
            __extends(PressRecognizer, _super);
            function PressRecognizer(options) {
                var _this = _super.call(this, mergeOptions(options, PressRecognizer.defaults)) || this;
                _this._timer = null;
                _this._input = null;
                return _this;
            }
            PressRecognizer.prototype.getTouchAction = function () {
                return ['auto'];
            };
            PressRecognizer.prototype.process = function (input) {
                var _this = this;
                var validPointers = input.pointers.length === this.options.pointers;
                var validMovement = input.distance < this.options.threshold;
                var validTime = input.deltaTime > this.options.time;
                this._input = input;
                if (!validMovement || !validPointers || input.eventType & (INPUT_END | INPUT_CANCEL) && !validTime) {
                    this.reset();
                }
                else if (input.eventType & INPUT_START) {
                    this.reset();
                    this._timer = setTimeoutContext(function () {
                        _this.state = State.Recognized;
                        _this.tryEmit();
                    }, this.options.time, this);
                }
                else if (input.eventType & INPUT_END) {
                    return State.Recognized;
                }
                return State.Failed;
            };
            PressRecognizer.prototype.reset = function () {
                clearTimeout(this._timer);
            };
            PressRecognizer.prototype.emit = function (input) {
                if (this.state !== State.Recognized) {
                    return;
                }
                if (input && input.eventType & INPUT_END) {
                    this.manager.emit(this.options.event + 'up', input);
                }
                else {
                    this._input.timeStamp = Date.now();
                    this.manager.emit(this.options.event, this._input);
                }
            };
            return PressRecognizer;
        }(Recognizer));
        PressRecognizer.defaults = {
            event: 'press',
            pointers: 1,
            time: 251,
            threshold: 9
        };
        function cleanTouchActions(actions) {
            if (actions.includes('none')) {
                return 'none';
            }
            var hasPanX = actions.includes('pan-x');
            var hasPanY = actions.includes('pan-y');
            if (hasPanX && hasPanY) {
                return 'none';
            }
            if (hasPanX || hasPanY) {
                return hasPanX ? 'pan-x' : 'pan-y';
            }
            if (actions.includes('manipulation')) {
                return 'manipulation';
            }
            return 'auto';
        }
        var TouchAction = (function () {
            function TouchAction(manager, value) {
                this.manager = manager;
                this.set(value);
            }
            TouchAction.prototype.set = function (value) {
                if (value === 'compute') {
                    value = this.compute();
                }
                if (supportsTouchAction && this.manager.element.style && TOUCH_ACTION_MAP[value]) {
                    this.manager.element.style['touchAction'] = value;
                }
                this.actions = value.toLowerCase().trim();
            };
            TouchAction.prototype.update = function () {
                this.set(this.manager.options.touchAction);
            };
            TouchAction.prototype.compute = function () {
                var actions = [];
                for (var _a = 0, _b = this.manager.recognizers; _a < _b.length; _a++) {
                    var recognizer = _b[_a];
                    if (boolOrFn(recognizer.options.enable, [recognizer])) {
                        actions = actions.concat(recognizer.getTouchAction());
                    }
                }
                return cleanTouchActions(actions.join(' '));
            };
            TouchAction.prototype.preventDefaults = function (input) {
                var srcEvent = input.srcEvent;
                var direction = input.offsetDirection;
                if (this.manager.session.prevented) {
                    srcEvent.preventDefault();
                    return;
                }
                var actions = this.actions;
                var hasNone = actions.includes('none') && !TOUCH_ACTION_MAP['none'];
                var hasPanY = actions.includes('pan-y') && !TOUCH_ACTION_MAP['pan-y'];
                var hasPanX = actions.includes('pan-x') && !TOUCH_ACTION_MAP['pan-x'];
                if (hasNone) {
                    var isTapPointer = input.pointers.length === 1;
                    var isTapMovement = input.distance < 2;
                    var isTapTouchTime = input.deltaTime < 250;
                    if (isTapPointer && isTapMovement && isTapTouchTime) {
                        return;
                    }
                }
                if (hasPanX && hasPanY) {
                    return;
                }
                if (hasNone || hasPanY && direction & Direction.Horizontal || hasPanX && direction & Direction.Vertical) {
                    return this.preventSrc(srcEvent);
                }
            };
            TouchAction.prototype.preventSrc = function (srcEvent) {
                this.manager.session.prevented = true;
                srcEvent.preventDefault();
            };
            return TouchAction;
        }());
        function hasParent(node, parent) {
            while (node) {
                if (node === parent) {
                    return true;
                }
                node = node.parentNode;
            }
            return false;
        }
        function getCenter(pointers) {
            var pointersLength = pointers.length;
            if (pointersLength === 1) {
                return {
                    x: Math.round(pointers[0].clientX),
                    y: Math.round(pointers[0].clientY)
                };
            }
            var x = 0;
            var y = 0;
            var i = 0;
            while (i < pointersLength) {
                x += pointers[i].clientX;
                y += pointers[i].clientY;
                i++;
            }
            return {
                x: Math.round(x / pointersLength),
                y: Math.round(y / pointersLength)
            };
        }
        function simpleCloneInputData(input) {
            var pointers = [];
            var i = 0;
            while (i < input.pointers.length) {
                pointers[i] = {
                    clientX: Math.round(input.pointers[i].clientX),
                    clientY: Math.round(input.pointers[i].clientY)
                };
                i++;
            }
            return {
                timeStamp: Date.now(),
                pointers: pointers,
                center: getCenter(pointers),
                deltaX: input.deltaX,
                deltaY: input.deltaY
            };
        }
        function getAngle(p1, p2, props) {
            if (!props) {
                props = ['x', 'y'];
            }
            var x = p2[props[0]] - p1[props[0]];
            var y = p2[props[1]] - p1[props[1]];
            return Math.atan2(y, x) * 180 / Math.PI;
        }
        function getDirection(x, y) {
            if (x === y) {
                return Direction.None;
            }
            if (Math.abs(x) >= Math.abs(y)) {
                return x < 0 ? Direction.Left : Direction.Right;
            }
            return y < 0 ? Direction.Up : Direction.Down;
        }
        function computeDeltaXY(session, input) {
            var center = input.center;
            var offset = session.offsetDelta || {};
            var prevDelta = session.prevDelta || {};
            var prevInput = session.prevInput || {};
            if (input.eventType === INPUT_START || prevInput.eventType === INPUT_END) {
                prevDelta = session.prevDelta = {
                    x: prevInput.deltaX || 0,
                    y: prevInput.deltaY || 0
                };
                offset = session.offsetDelta = {
                    x: center.x,
                    y: center.y
                };
            }
            input.deltaX = prevDelta.x + (center.x - offset.x);
            input.deltaY = prevDelta.y + (center.y - offset.y);
        }
        function getVelocity(deltaTime, x, y) {
            return {
                x: x / deltaTime || 0,
                y: y / deltaTime || 0
            };
        }
        function getScale(start, end) {
            return getDistance(end[0], end[1], PROPS_CLIENT_XY) / getDistance(start[0], start[1], PROPS_CLIENT_XY);
        }
        function getRotation(start, end) {
            return getAngle(end[1], end[0], PROPS_CLIENT_XY) + getAngle(start[1], start[0], PROPS_CLIENT_XY);
        }
        function computeIntervalInputData(session, input) {
            var last = session.lastInterval || input;
            var deltaTime = input.timeStamp - last.timeStamp;
            var velocity = void 0;
            var velocityX = void 0;
            var velocityY = void 0;
            var direction = void 0;
            if (input.eventType !== INPUT_CANCEL && (deltaTime > COMPUTE_INTERVAL || last.velocity === undefined)) {
                var deltaX = input.deltaX - last.deltaX;
                var deltaY = input.deltaY - last.deltaY;
                var v = getVelocity(deltaTime, deltaX, deltaY);
                velocityX = v.x;
                velocityY = v.y;
                velocity = Math.abs(v.x) > Math.abs(v.y) ? v.x : v.y;
                direction = getDirection(deltaX, deltaY);
                session.lastInterval = input;
            }
            else {
                velocity = last.velocity;
                velocityX = last.velocityX;
                velocityY = last.velocityY;
                direction = last.direction;
            }
            input.velocity = velocity;
            input.velocityX = velocityX;
            input.velocityY = velocityY;
            input.direction = direction;
        }
        function computeInputData(manager, input) {
            var session = manager.session;
            var pointers = input.pointers;
            var pointersLength = pointers.length;
            if (!session.firstInput) {
                session.firstInput = simpleCloneInputData(input);
            }
            if (pointersLength > 1 && !session.firstMultiple) {
                session.firstMultiple = simpleCloneInputData(input);
            }
            else if (pointersLength === 1) {
                session.firstMultiple = false;
            }
            var firstInput = session.firstInput;
            var firstMultiple = session.firstMultiple;
            var offsetCenter = firstMultiple ? firstMultiple.center : firstInput.center;
            var center = input.center = getCenter(pointers);
            input.timeStamp = Date.now();
            input.deltaTime = input.timeStamp - firstInput.timeStamp;
            input.angle = getAngle(offsetCenter, center);
            input.distance = getDistance(offsetCenter, center);
            computeDeltaXY(session, input);
            input.offsetDirection = getDirection(input.deltaX, input.deltaY);
            var overallVelocity = getVelocity(input.deltaTime, input.deltaX, input.deltaY);
            input.overallVelocityX = overallVelocity.x;
            input.overallVelocityY = overallVelocity.y;
            input.overallVelocity = Math.abs(overallVelocity.x) > Math.abs(overallVelocity.y) ? overallVelocity.x : overallVelocity.y;
            input.scale = firstMultiple ? getScale(firstMultiple.pointers, pointers) : 1;
            input.rotation = firstMultiple ? getRotation(firstMultiple.pointers, pointers) : 0;
            input.maxPointers = !session.prevInput ? input.pointers.length : input.pointers.length > session.prevInput.maxPointers ? input.pointers.length : session.prevInput.maxPointers;
            computeIntervalInputData(session, input);
            var target = manager.element;
            if (hasParent(input.srcEvent.target, target)) {
                target = input.srcEvent.target;
            }
            input.target = target;
        }
        function inputHandler(manager, eventType, input) {
            var pointersLen = input.pointers.length;
            var changedPointersLen = input.changedPointers.length;
            var isFirst = eventType & INPUT_START && pointersLen - changedPointersLen === 0;
            var isFinal = eventType & (INPUT_END | INPUT_CANCEL) && pointersLen - changedPointersLen === 0;
            input.isFirst = !!isFirst;
            input.isFinal = !!isFinal;
            if (isFirst) {
                manager.session = {
                    stopped: 0
                };
            }
            input.eventType = eventType;
            computeInputData(manager, input);
            manager.emit('hammer.input', input);
            manager.recognize(input);
            manager.session.prevInput = input;
        }
        function splitStr(text) {
            return text.trim().split(/\s+/g);
        }
        function addEventListeners(target, types, handler) {
            for (var _a = 0, _b = splitStr(types); _a < _b.length; _a++) {
                var type = _b[_a];
                target.addEventListener(type, handler, false);
            }
        }
        function removeEventListeners(target, types, handler) {
            for (var _a = 0, _b = splitStr(types); _a < _b.length; _a++) {
                var type = _b[_a];
                target.removeEventListener(type, handler, false);
            }
        }
        function getWindowForElement(element) {
            var doc = element.ownerDocument || element;
            return doc.defaultView || doc.parentWindow || window;
        }
        var Input = (function () {
            function Input(manager, callback) {
                var _this = this;
                this.manager = manager;
                this.callback = callback;
                this.element = manager.element;
                this.target = manager.options.inputTarget;
                this.domHandler = function (ev) {
                    if (boolOrFn(manager.options.enable, [manager])) {
                        _this.handler(ev);
                    }
                };
            }
            Input.prototype.init = function () {
                this.evEl && addEventListeners(this.element, this.evEl, this.domHandler);
                this.evTarget && addEventListeners(this.target, this.evTarget, this.domHandler);
                this.evWin && addEventListeners(getWindowForElement(this.element), this.evWin, this.domHandler);
            };
            Input.prototype.destroy = function () {
                this.evEl && removeEventListeners(this.element, this.evEl, this.domHandler);
                this.evTarget && removeEventListeners(this.target, this.evTarget, this.domHandler);
                this.evWin && removeEventListeners(getWindowForElement(this.element), this.evWin, this.domHandler);
            };
            return Input;
        }());
        var POINTER_INPUT_MAP = {
            pointerdown: INPUT_START,
            pointermove: INPUT_MOVE,
            pointerup: INPUT_END,
            pointercancel: INPUT_CANCEL,
            pointerout: INPUT_CANCEL
        };
        var PointerEventInput = (function (_super) {
            __extends(PointerEventInput, _super);
            function PointerEventInput(manager, callback) {
                var _this = _super.call(this, manager, callback) || this;
                _this.evEl = 'pointerdown';
                _this.evWin = 'pointermove pointerup pointercancel';
                _this.store = _this.manager.session.pointerEvents = [];
                _this.init();
                return _this;
            }
            PointerEventInput.prototype.handler = function (ev) {
                var removePointer = false;
                var eventTypeNormalized = ev.type.toLowerCase().replace('ms', '');
                var eventType = POINTER_INPUT_MAP[eventTypeNormalized];
                var pointerType = ev.pointerType;
                var isTouch = pointerType === 'touch';
                var storeIndex = inArray(this.store, ev.pointerId, 'pointerId');
                if (eventType & INPUT_START && (ev.button === 0 || isTouch)) {
                    if (storeIndex < 0) {
                        this.store.push(ev);
                        storeIndex = this.store.length - 1;
                    }
                }
                else if (eventType & (INPUT_END | INPUT_CANCEL)) {
                    removePointer = true;
                }
                if (storeIndex < 0) {
                    return;
                }
                this.store[storeIndex] = ev;
                this.callback(this.manager, eventType, {
                    pointers: this.store,
                    changedPointers: [ev],
                    pointerType: pointerType,
                    srcEvent: ev
                });
                if (removePointer) {
                    this.store.splice(storeIndex, 1);
                }
            };
            return PointerEventInput;
        }(Input));
        function uniqueArray(src, key, sort) {
            if (sort === void 0) { sort = false; }
            var results = [];
            var values = [];
            var i = 0;
            while (i < src.length) {
                var val = key ? src[i][key] : src[i];
                if (inArray(values, val) < 0) {
                    results.push(src[i]);
                }
                values[i] = val;
                i++;
            }
            if (sort) {
                if (!key) {
                    results = results.sort();
                }
                else {
                    results = results.sort(function (a, b) {
                        return a[key] > b[key];
                    });
                }
            }
            return results;
        }
        var TOUCH_INPUT_MAP = {
            touchstart: INPUT_START,
            touchmove: INPUT_MOVE,
            touchend: INPUT_END,
            touchcancel: INPUT_CANCEL
        };
        var TOUCH_TARGET_EVENTS = 'touchstart touchmove touchend touchcancel';
        var TouchInput = (function (_super) {
            __extends(TouchInput, _super);
            function TouchInput(manager, callback) {
                var _this = _super.call(this, manager, callback) || this;
                _this.evTarget = TOUCH_TARGET_EVENTS;
                _this.evTarget = TOUCH_TARGET_EVENTS;
                _this.init();
                return _this;
            }
            TouchInput.prototype.handler = function (ev) {
                var type = TOUCH_INPUT_MAP[ev.type];
                var touches = getTouches.call(this, ev, type);
                if (!touches) {
                    return;
                }
                this.callback(this.manager, type, {
                    pointers: touches[0],
                    changedPointers: touches[1],
                    pointerType: 'touch',
                    srcEvent: ev
                });
            };
            return TouchInput;
        }(Input));
        function getTouches(ev, type) {
            var allTouches = Array.from(ev.touches);
            var targetIds = this.targetIds;
            if (type & (INPUT_START | INPUT_MOVE) && allTouches.length === 1) {
                targetIds[allTouches[0].identifier] = true;
                return [allTouches, allTouches];
            }
            var i = void 0;
            var targetTouches = void 0;
            var changedTouches = Array.from(ev.changedTouches);
            var changedTargetTouches = [];
            var target = this.target;
            targetTouches = allTouches.filter(function (touch) {
                return hasParent(touch.target, target);
            });
            if (type === INPUT_START) {
                i = 0;
                while (i < targetTouches.length) {
                    targetIds[targetTouches[i].identifier] = true;
                    i++;
                }
            }
            i = 0;
            while (i < changedTouches.length) {
                if (targetIds[changedTouches[i].identifier]) {
                    changedTargetTouches.push(changedTouches[i]);
                }
                if (type & (INPUT_END | INPUT_CANCEL)) {
                    delete targetIds[changedTouches[i].identifier];
                }
                i++;
            }
            if (!changedTargetTouches.length) {
                return;
            }
            return [
                uniqueArray(targetTouches.concat(changedTargetTouches), 'identifier', true), changedTargetTouches
            ];
        }
        var MOUSE_INPUT_MAP = {
            mousedown: INPUT_START,
            mousemove: INPUT_MOVE,
            mouseup: INPUT_END
        };
        var MouseInput = (function (_super) {
            __extends(MouseInput, _super);
            function MouseInput(manager, callback) {
                var _this = _super.call(this, manager, callback) || this;
                _this.pressed = false;
                _this.evEl = 'mousedown';
                _this.evWin = 'mousemove mouseup';
                _this.init();
                return _this;
            }
            MouseInput.prototype.handler = function (ev) {
                var eventType = MOUSE_INPUT_MAP[ev.type];
                if (eventType & INPUT_START && ev.button === 0) {
                    this.pressed = true;
                }
                if (eventType & INPUT_MOVE && ev.which !== 1) {
                    eventType = INPUT_END;
                }
                if (!this.pressed) {
                    return;
                }
                if (eventType & INPUT_END) {
                    this.pressed = false;
                }
                this.callback(this.manager, eventType, {
                    pointers: [ev],
                    changedPointers: [ev],
                    pointerType: 'mouse',
                    srcEvent: ev
                });
            };
            return MouseInput;
        }(Input));
        var DEDUP_TIMEOUT = 2500;
        var DEDUP_DISTANCE = 25;
        var TouchMouseInput = (function (_super) {
            __extends(TouchMouseInput, _super);
            function TouchMouseInput(manager, callback) {
                var _this = _super.call(this, manager, callback) || this;
                _this.primaryTouch = null;
                _this.lastTouches = [];
                var handler = _this.handler.bind(_this);
                _this.touch = new TouchInput(_this.manager, handler);
                _this.mouse = new MouseInput(_this.manager, handler);
                _this.init();
                return _this;
            }
            TouchMouseInput.prototype.handler = function (manager, inputEvent, inputData) {
                var isTouch = inputData.pointerType === 'touch';
                var isMouse = inputData.pointerType === 'mouse';
                if (isMouse && inputData.sourceCapabilities && inputData.sourceCapabilities.firesTouchEvents) {
                    return;
                }
                if (isTouch) {
                    recordTouches.call(this, inputEvent, inputData);
                }
                else if (isMouse && isSyntheticEvent.call(this, inputData)) {
                    return;
                }
                this.callback(manager, inputEvent, inputData);
            };
            TouchMouseInput.prototype.destroy = function () {
                this.touch.destroy();
                this.mouse.destroy();
            };
            return TouchMouseInput;
        }(Input));
        function recordTouches(eventType, eventData) {
            if (eventType & INPUT_START) {
                this.primaryTouch = eventData.changedPointers[0].identifier;
                setLastTouch.call(this, eventData);
            }
            else if (eventType & (INPUT_END | INPUT_CANCEL)) {
                setLastTouch.call(this, eventData);
            }
        }
        function setLastTouch(eventData) {
            var _this2 = this;
            var _eventData$changedPoi = slicedToArray(eventData.changedPointers, 1);
            var touch = _eventData$changedPoi[0];
            if (touch.identifier === this.primaryTouch) {
                (function () {
                    var lastTouch = { x: touch.clientX, y: touch.clientY };
                    _this2.lastTouches.push(lastTouch);
                    var lts = _this2.lastTouches;
                    var removeLastTouch = function removeLastTouch() {
                        var i = lts.indexOf(lastTouch);
                        if (i > -1) {
                            lts.splice(i, 1);
                        }
                    };
                    setTimeout(removeLastTouch, DEDUP_TIMEOUT);
                })();
            }
        }
        function isSyntheticEvent(eventData) {
            var x = eventData.srcEvent.clientX;
            var y = eventData.srcEvent.clientY;
            for (var i = 0; i < this.lastTouches.length; i++) {
                var t = this.lastTouches[i];
                var dx = Math.abs(x - t.x);
                var dy = Math.abs(y - t.y);
                if (dx <= DEDUP_DISTANCE && dy <= DEDUP_DISTANCE) {
                    return true;
                }
            }
            return false;
        }
        function createInputInstance(manager) {
            var type = void 0;
            var inputClass = manager.options.inputClass;
            if (inputClass) {
                type = inputClass;
            }
            else if (Gestures.supportsPointerEvents) {
                type = PointerEventInput;
            }
            else if (Gestures.supportsOnlyTouch) {
                type = TouchInput;
            }
            else if (!Gestures.supportsTouch) {
                type = MouseInput;
            }
            else {
                type = TouchMouseInput;
            }
            console.log('INPUT', type);
            return new type(manager, inputHandler);
        }
        var STOP = 1;
        var FORCED_STOP = 2;
        var Manager = (function () {
            function Manager(element, options) {
                this.options = {};
                this.handlers = {};
                this.session = {};
                this.recognizers = [];
                this.oldCssProps = {};
                this.options = mergeOptions(options, defaults);
                this.options.inputTarget = this.options.inputTarget || element;
                this.element = element;
                this.input = createInputInstance(this);
                this.touchAction = new TouchAction(this, this.options.touchAction);
                toggleCssProps(this, true);
                if (this.options.recognizers) {
                    for (var _a = 0, _b = this.options.recognizers; _a < _b.length; _a++) {
                        var item = _b[_a];
                        var recognizer = this.add(new item[0](item[1]));
                        item[2] && recognizer.recognizeWith(item[2]);
                        item[3] && recognizer.requireFailure(item[3]);
                    }
                }
            }
            Manager.prototype.set = function (options) {
                Object.assign(this.options, options);
                if (options.touchAction) {
                    this.touchAction.update();
                }
                if (options.inputTarget) {
                    this.input.destroy();
                    this.input.target = options.inputTarget;
                    this.input.init();
                }
                return this;
            };
            Manager.prototype.stop = function (force) {
                this.session.stopped = force ? FORCED_STOP : STOP;
            };
            Manager.prototype.recognize = function (inputData) {
                var session = this.session;
                if (session.stopped) {
                    return;
                }
                this.touchAction.preventDefaults(inputData);
                var recognizer = void 0;
                var recognizers = this.recognizers;
                var curRecognizer = session.curRecognizer;
                if (!curRecognizer || curRecognizer && curRecognizer.state & State.Recognized) {
                    curRecognizer = session.curRecognizer = null;
                }
                var i = 0;
                while (i < recognizers.length) {
                    recognizer = recognizers[i];
                    if (session.stopped !== FORCED_STOP && (!curRecognizer || recognizer === curRecognizer ||
                        recognizer.canRecognizeWith(curRecognizer))) {
                        recognizer.recognize(inputData);
                    }
                    else {
                        recognizer.reset();
                    }
                    if (!curRecognizer && recognizer.state & (State.Began | State.Changed | State.Ended)) {
                        curRecognizer = session.curRecognizer = recognizer;
                    }
                    i++;
                }
            };
            Manager.prototype.get = function (recognizer) {
                if (recognizer instanceof Recognizer) {
                    return recognizer;
                }
                var recognizers = this.recognizers;
                for (var i = 0; i < recognizers.length; i++) {
                    if (recognizers[i].options.event === recognizer) {
                        return recognizers[i];
                    }
                }
                return null;
            };
            Manager.prototype.add = function (recognizer) {
                if (invokeArrayArg(recognizer, 'add', this)) {
                    return this;
                }
                var existing = this.get(recognizer.options.event);
                if (existing) {
                    this.remove(existing);
                }
                this.recognizers.push(recognizer);
                recognizer.manager = this;
                this.touchAction.update();
                return recognizer;
            };
            Manager.prototype.remove = function (recognizer) {
                if (invokeArrayArg(recognizer, 'remove', this)) {
                    return this;
                }
                recognizer = this.get(recognizer);
                if (recognizer) {
                    var recognizers = this.recognizers;
                    var index = inArray(recognizers, recognizer);
                    if (index !== -1) {
                        recognizers.splice(index, 1);
                        this.touchAction.update();
                    }
                }
                return this;
            };
            Manager.prototype.on = function (eventTypes, handler) {
                if (eventTypes === undefined) {
                    return;
                }
                if (handler === undefined) {
                    return;
                }
                var handlers = this.handlers;
                for (var _a = 0, _b = splitStr(eventTypes); _a < _b.length; _a++) {
                    var type = _b[_a];
                    handlers[type] = handlers[type] || [];
                    handlers[type].push(handler);
                }
                return this;
            };
            Manager.prototype.off = function (eventTypes, handler) {
                if (eventTypes === undefined) {
                    return;
                }
                var handlers = this.handlers;
                for (var _a = 0, _b = splitStr(eventTypes); _a < _b.length; _a++) {
                    var type = _b[_a];
                    if (!handler) {
                        delete handlers[type];
                    }
                    else {
                        handlers[type] && handlers[type].splice(inArray(handlers[type], handler), 1);
                    }
                }
                return this;
            };
            Manager.prototype.emit = function (eventType, data) {
                if (this.options.domEvents) {
                    triggerDomEvent(eventType, data);
                }
                var handlers = this.handlers[eventType] && this.handlers[eventType].slice();
                if (!handlers || !handlers.length) {
                    return;
                }
                data.type = eventType;
                data.preventDefault = function () {
                    data.srcEvent.preventDefault();
                };
                var i = 0;
                while (i < handlers.length) {
                    handlers[i](data);
                    i++;
                }
            };
            Manager.prototype.destroy = function () {
                this.element && toggleCssProps(this, false);
                this.handlers = {};
                this.session = {
                    stopped: 0
                };
                this.input.destroy();
                this.element = null;
            };
            return Manager;
        }());
        Gestures.Manager = Manager;
        function toggleCssProps(manager, add) {
            var element = manager.element;
            if (!element.style) {
                return;
            }
            var prop = void 0;
            each(manager.options.cssProps, function (value, name) {
                prop = name;
                if (add) {
                    manager.oldCssProps[prop] = element.style[prop];
                    element.style[prop] = value;
                }
                else {
                    element.style[prop] = manager.oldCssProps[prop] || '';
                }
            });
            if (!add) {
                manager.oldCssProps = {};
            }
        }
        function triggerDomEvent(eventType, data) {
            var gestureEvent = document.createEvent('Event');
            gestureEvent.initEvent(eventType, true, true);
            gestureEvent.gesture = data;
            data.target.dispatchEvent(gestureEvent);
        }
        var SINGLE_TOUCH_INPUT_MAP = {
            touchstart: INPUT_START,
            touchmove: INPUT_MOVE,
            touchend: INPUT_END,
            touchcancel: INPUT_CANCEL
        };
        var SingleTouchInput = (function (_super) {
            __extends(SingleTouchInput, _super);
            function SingleTouchInput(manager, callback) {
                var _this = _super.call(this, manager, callback) || this;
                _this.started = false;
                _this.evTarget = 'touchstart';
                _this.evWin = 'touchstart touchmove touchend touchcancel';
                _this.init();
                return _this;
            }
            SingleTouchInput.prototype.handler = function (ev) {
                var type = SINGLE_TOUCH_INPUT_MAP[ev.type];
                if (type === INPUT_START) {
                    this.started = true;
                }
                if (!this.started) {
                    return;
                }
                var touches = normalizeSingleTouches.call(this, ev, type);
                if (type & (INPUT_END | INPUT_CANCEL) && touches[0].length - touches[1].length === 0) {
                    this.started = false;
                }
                this.callback(this.manager, type, {
                    pointers: touches[0],
                    changedPointers: touches[1],
                    pointerType: 'touch',
                    srcEvent: ev
                });
            };
            return SingleTouchInput;
        }(Input));
        function normalizeSingleTouches(ev, type) {
            var all = Array.from(ev.touches);
            var changed = Array.from(ev.changedTouches);
            if (type & (INPUT_END | INPUT_CANCEL)) {
                all = uniqueArray(all.concat(changed), 'identifier', true);
            }
            return [all, changed];
        }
        var presets = [
            [RotateRecognizer, { enable: false }],
            [PinchRecognizer, { enable: false }, ['rotate']],
            [SwipeRecognizer, { direction: Direction.Horizontal }],
            [PanRecognizer, { direction: Direction.Horizontal }, ['swipe']], [TapRecognizer],
            [TapRecognizer, { event: 'doubletap', taps: 2 }, ['tap']], [PressRecognizer]
        ];
        var defaults = {
            domEvents: false,
            touchAction: 'compute',
            enable: true,
            inputTarget: null,
            inputClass: null,
            cssProps: {
                userSelect: 'none',
                touchSelect: 'none',
                touchCallout: 'none',
                contentZooming: 'none',
                userDrag: 'none',
                tapHighlightColor: 'rgba(0,0,0,0)'
            }
        };
        Gestures.Pan = PanRecognizer;
        Gestures.Pinch = PinchRecognizer;
        Gestures.Press = PressRecognizer;
        Gestures.Rotate = RotateRecognizer;
        Gestures.Swipe = SwipeRecognizer;
        Gestures.Tap = TapRecognizer;
    })(Gestures = Carbon.Gestures || (Carbon.Gestures = {}));
})(Carbon || (Carbon = {}));
