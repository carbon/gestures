/*!
 * by Jason Nelson @iamcarbon;
 * Extended from Hammer.JS - v2.0.8 by Jorik Tangelder; (http://hammerjs.github.io/)
 * Licensed under the MIT license 
 */

module Carbon {
  export module Gestures {    
    function getTouchActionProps() {
      if (!supportsTouchAction) {
        return false;
      }
      
      var touchMap = { };

      [ 'auto', 'manipulation', 'pan-y', 'pan-x', 'pan-x pan-y', 'none'].forEach(function (val) {
        return touchMap[val] = CSS.supports('touch-action', val);
      });
      return touchMap;
    }

    let testElement = document.createElement('div');

    let supportsTouchAction = 'touchAction' in testElement.style;
    
    let TOUCH_ACTION_AUTO = 'auto';
    let TOUCH_ACTION_MAP = getTouchActionProps();
    
    let MOBILE_REGEX = /mobile|tablet|ip(ad|hone|od)|android/i;
    
    export const supportsTouch = 'ontouchstart' in window;
    export const supportsPointerEvents = window['PointerEvent'] !== undefined;
    export const supportsOnlyTouch = supportsTouch && MOBILE_REGEX.test(navigator.userAgent);
      
    let COMPUTE_INTERVAL = 25;
    
    let INPUT_START = 1;
    let INPUT_MOVE = 2;
    let INPUT_END = 4;
    let INPUT_CANCEL = 8;
    
    enum Direction {
      None = 1,
      Left = 2,
      Right = 4,
      Up = 8,
      Down = 16,
      Horizontal = Left | Right,
      Vertical = Up | Down,
      All = Horizontal | Vertical
    };
    
    let PROPS_XY = [ 'x', 'y' ];
    let PROPS_CLIENT_XY = ['clientX', 'clientY'];
    
    enum State {
      Possible = 1,
      Began = 2,
      Changed = 4,
      Ended = 8,
      Recognized = 8, // Alias for ended
      Canceled = 16,
      Failed = 32
    };

    /**
     * get a unique id
     */
    var _uniqueId = 1;
    
    function uniqueId(): number {
      return _uniqueId++;
    }
    
    /**
     * walk objects and arrays
     */
    function each(obj: any, iterator: Function, context?: any) {
      var i = void 0;
    
      if (!obj) return;
    
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

    function mergeOptions<T>(options: T, defaultOptions: any) : T {
      let result = { };

      Object.assign(result, defaultOptions);

      if (options) {
        Object.assign(result, options);
      }

      return result as T;
    }
    
    /**
     * if the argument is an array, we want to execute the fn on each entry
     * if it aint an array we don't want to do a thing.
     * this is used by all the methods that accept a single and array argument.
     * @param {*|Array} arg
     */
    function invokeArrayArg(arg, fn: string, context: any): boolean {
      if (Array.isArray(arg)) {
        each(arg, context[fn], context);
        return true;
      }
      return false;
    }
    
    /**
     * find if a array contains the object using indexOf or a simple polyFill
     * @param {Array} src
     */
    function inArray<T>(src, find: T, findByKey?: string): number {
      if (src.indexOf && !findByKey) {
        return src.indexOf(find);
      } 
      else {
        var i = 0;
        while (i < src.length) {
          if (findByKey && src[i][findByKey] == find || !findByKey && src[i] === find) {
            // do not use === here, test fails
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
    
            if (i && _arr.length === i) break;
          }
        } catch (err) {
          _d = true;
          _e = err;
        } finally {
          try {
            if (!_n && _i["return"]) _i["return"]();
          } finally {
            if (_d) throw _e;
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
    
    /**
     * let a boolean value also be a function that must return a boolean
     * this first item in args will be used as the context
     * @param {Boolean|Function} val
     * @param {Array} [args]
     */
    function boolOrFn(val, args): boolean {
      if ((typeof val === 'undefined' ? 'undefined' : _typeof(val)) === 'function') {
        return val.apply(args ? args[0] || undefined : undefined, args);
      }
      return val;
    }
    
    /**
     * get a recognizer by name if it is bound to a manager
     * @returns {Recognizer}
     */
    function getRecognizerByNameIfManager(otherRecognizer: Recognizer | string, recognizer: Recognizer) {

      console.log(otherRecognizer);

      if (recognizer.manager) {
        return  recognizer.manager.get(otherRecognizer);
      }

      return otherRecognizer;
    }
    
    /**
     * get a usable string, used as event postfix
     */
    function stateStr(state: State) : string {
      if (state & State.Canceled) {
        return 'cancel';
      } else if (state & State.Ended) {
        return 'end';
      } else if (state & State.Changed) {
        return 'move';
      } else if (state & State.Began) {
        return 'start';
      }
      return '';
    }
    
    /**
     * Recognizer flow explained; *
     * All recognizers have the initial state of POSSIBLE when a input session starts.
     * The definition of a input session is from the first input until the last input, with all it's movement in it. *
     * Example session for mouse-input: mousedown -> mousemove -> mouseup
     *
     * On each recognizing cycle (see Manager.recognize) the .recognize() method is executed
     * which determines with state it should be.
     *
     * If the recognizer has the state FAILED, CANCELLED or RECOGNIZED (equals ENDED), it is reset to
     * POSSIBLE to give it another change on the next cycle.
     *
     *               Possible
     *                  |
     *            +-----+---------------+
     *            |                     |
     *      +-----+-----+               |
     *      |           |               |
     *   Failed      Cancelled          |
     *                          +-------+------+
     *                          |              |
     *                      Recognized       Began
     *                                         |
     *                                      Changed
     *                                         |
     *                                  Ended/Recognized
     */
      
    abstract class Recognizer {
      id = uniqueId();
      manager: Manager = null;
      options: any;
      state = State.Possible;

      simultaneous: any = { };
      requireFail: Array<Recognizer> = [ ];

      constructor(options) {
        this.options = options;

        // default is enable true
        this.options.enable = this.options.enable !== false;
      }
    
      set(options: Options): Recognizer {
        Object.assign(this.options, options);

        // also update the touchAction, in case something changed about the directions/enabled state
        this.manager && this.manager.touchAction.update();
        
        return this;
      }
    
      recognizeWith(otherRecognizer) {
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
      }

      /**
       * drop the simultaneous link. it doesnt remove the link on the other recognizer.
       */
      dropRecognizeWith(otherRecognizer: Recognizer) : Recognizer{
        if (invokeArrayArg(otherRecognizer, 'dropRecognizeWith', this)) {
          return this;
        }

        otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
        delete this.simultaneous[otherRecognizer.id];
        return this;
      }

      /**
       * recognizer can only run when an other is failing
       * @param {Recognizer} otherRecognizer
       * @returns {Recognizer} this
       */
      requireFailure(otherRecognizer) {
        if (invokeArrayArg(otherRecognizer, 'requireFailure', this)) {
          return this;
        }

        otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);

        if (inArray(this.requireFail, otherRecognizer) === -1) {
          this.requireFail.push(otherRecognizer);
          otherRecognizer.requireFailure(this);
        }

        return this;
      }

      /**
       * drop the requireFailure link. it does not remove the link on the other recognizer.
       * @param {Recognizer} otherRecognizer
       */
      dropRequireFailure(otherRecognizer) : Recognizer {
        if (invokeArrayArg(otherRecognizer, 'dropRequireFailure', this)) {
          return this;
        }

        otherRecognizer = getRecognizerByNameIfManager(otherRecognizer, this);
        var index = inArray(this.requireFail, otherRecognizer);
        if (index > -1) {
          this.requireFail.splice(index, 1);
        }
        return this;
      }

      hasRequireFailures(): boolean {
        return this.requireFail.length > 0;
      }
    
      /**
       * if the recognizer can recognize simultaneous with an other recognizer
       */
      canRecognizeWith(otherRecognizer: Recognizer): boolean {
        return !!this.simultaneous[otherRecognizer.id];
      }
    
      /**
       * You should use `tryEmit` instead of `emit` directly to check
       * that all the needed recognizers has failed before emitting.
       */
      emit(input: any) {
        var state = this.state;
        var base = this;

        function _emit(eventType) {
          base.manager.emit(eventType, input);
        }

        // 'panstart' and 'panmove'
        if (state < State.Ended) {
          _emit(this.options.event + stateStr(state));
        }

        _emit(this.options.event); // simple 'eventName' events

        if (input.additionalEvent) {
          // additional event(panleft, panright, pinchin, pinchout...)
          _emit(input.additionalEvent);
        }

        // panend and pancancel
        if (state >= State.Ended) {
          _emit(this.options.event + stateStr(state));
        }
      } 
    
      /**
       * Check that all the require failure recognizers has failed,
       * if true, it emits a gesture event,
       * otherwise, setup the state to FAILED.
       */

      tryEmit(input?: any) {
        if (this.canEmit()) {
          return this.emit(input);
        }
        // it's failing anyway
        this.state = State.Failed;
      }
    
      canEmit(): boolean {
        var i = 0;
        while (i < this.requireFail.length) {
          if (!(this.requireFail[i].state & (State.Failed | State.Possible))) {
            return false;
          }
          i++;
        }
        return true;
      }
    
      /**
       * update the recognizer
       */
      recognize(inputData: any) {
        // make a new copy of the inputData
        // so we can change the inputData without messing up the other recognizers

        var inputDataClone: any = { };
        
        Object.assign(inputDataClone, inputData);

        // is is enabled and allow recognizing?
        if (!boolOrFn(this.options.enable, [this, inputDataClone])) {
          this.reset();
          this.state = State.Failed;
          return;
        }

        // reset when we've reached the end
        if (this.state & (State.Recognized | State.Canceled | State.Failed)) {
          this.state = State.Possible;
        }

        this.state = this.process(inputDataClone);

        // the recognizer has recognized a gesture
        // so trigger an event
        if (this.state & (State.Began | State.Changed | State.Ended | State.Canceled)) {
          this.tryEmit(inputDataClone);
        }
      }
    
      /**
      * return the state of the recognizer
      * the actual recognizing happens in this method
      */
      abstract process(inputData: any): State;
      
      /**
       * return the preferred touch-action
       */

      abstract getTouchAction(): Array<string>;
    
      /**
       * called when the gesture isn't allowed to recognize
       * like when another is being recognized or it is disabled
       */
      abstract reset();
    }

    /**
     * This recognizer is just used as a base for the simple attribute recognizers.
     */
    
    class AttrRecognizer extends Recognizer {
      static defaults = {
        pointers: 1 // number
      };

      constructor(options?) {
        super(mergeOptions(options, AttrRecognizer.defaults));
      }
    
      /**
       * Used to check if it the recognizer receives valid input, like input.distance > 10.
       */  
      attrTest(input: any): boolean {
        var optionPointers = this.options.pointers;
        
        return optionPointers === 0 || input.pointers.length === optionPointers;
      }
    
      /**
       * Process the input and return the state for the recognizer
       */
      process(input: any): State {
        var state = this.state;
        var eventType = input.eventType;


        var isRecognized = state & (State.Began | State.Changed);
        var isValid = this.attrTest(input);

        // on cancel input and we've recognized before, return State.CANCELLED
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
      }

      getTouchAction() {
        return [ ];
      }

      reset() { }
    }
    
    interface RotateOptions {
      threshold: number;
      pointers: number;
    }

    /* Recognized when two or more pointer are moving in a circular motion. */
    class RotateRecognizer extends AttrRecognizer {
    
      static defaults = {
        event: 'rotate',
        threshold: 0,
        pointers: 2
      };

      constructor(options?: RotateOptions) {
        super(mergeOptions(options, RotateRecognizer.defaults));
      }
    
    getTouchAction() {
        return [ 'none' ];
      }
    
    attrTest(input) {
        return super.attrTest(input)
          && (Math.abs(input.rotation) > this.options.threshold || ((this.state & State.Began)) !== 0);
      }

      reset() { }
    }
    
    interface PinchOptions {
      threshhold: number;
      pointers: number;
    }
    /**
     * Pinch
     * Recognized when two or more pointers are moving toward (zoom-in) or away from each other (zoom-out).
     */
    class PinchRecognizer extends AttrRecognizer {  
      static defaults = {
        event: 'pinch',
        threshold: 0,
        pointers: 2
      };

      constructor(options?: PinchOptions) {
        super(mergeOptions(options, PinchRecognizer.defaults));
      }
    
      getTouchAction() {
        return [ 'none' ];
      }
      
      attrTest(input) {
        return super.attrTest(input) 
          && (Math.abs(input.scale - 1) > this.options.threshold || (this.state & State.Began) !== 0);
      }
    
      emit(input) {
        if (input.scale !== 1) {
          var inOut = input.scale < 1 ? 'in' : 'out';
          input.additionalEvent = this.options.event + inOut;
        }

        super.emit(input);
      }
    }
    
    function directionStr(direction: Direction): string {
      switch (direction) {
        case Direction.Down: return 'down';
        case Direction.Up: return 'up';
        case Direction.Left: return 'left';
        case Direction.Right: return 'right';
        default: return '';
      }
    }

    
    interface PanOptions {
      threshold: number;
      pointers: number;
      direction: Direction
    }

    /**
     * Pan
     * Recognized when the pointer is down and moved in the allowed direction.
     */
    class PanRecognizer extends AttrRecognizer {
      static defaults = {
        event: 'pan',
        threshold: 10,
        pointers: 1,
        direction: Direction.All
      };
      
      pX: number = null;
      pY: number = null;

      constructor(options?: PanOptions) {
        super(mergeOptions(options, PanRecognizer.defaults));
      }
    
      getTouchAction() {
        var direction = this.options.direction;

        let actions: Array<string> = [ ];

        if (direction & Direction.Horizontal) {
          actions.push('pan-y'); // y is correct
        }
        
        if (direction & Direction.Vertical) {
          actions.push('pan-x');
        }

        return actions;
      }

      directionTest(input) {
        var options = this.options;

        var hasMoved = true;
        var distance = input.distance;
        var direction = input.direction;

        var x = input.deltaX;
        var y = input.deltaY;
        
        // lock to axis?
        if (!(direction & options.direction)) {
          if (options.direction & Direction.Horizontal) {
            direction = x === 0 ? Direction.None : x < 0 ? Direction.Left : Direction.Right;
            hasMoved = x !== this.pX;
            distance = Math.abs(input.deltaX);
          } else {
            direction = y === 0 ? Direction.None : y < 0 ? Direction.Up : Direction.Down;
            hasMoved = y !== this.pY;
            distance = Math.abs(input.deltaY);
          }
        }
        input.direction = direction;
        return hasMoved && distance > options.threshold && direction & options.direction;
      }
    
      attrTest(input) {
        //replace with a super call?

        
        return super.attrTest(input) && (this.state & State.Began || !(this.state & State.Began) && this.directionTest(input));
      }

      emit(input) {
        this.pX = input.deltaX;
        this.pY = input.deltaY;

        var direction = directionStr(input.direction);

        if (direction) {
          input.additionalEvent = this.options.event + direction;
        }

        super.emit(input);
      }
    }
    
    /**
     * Swipe
     * Recognized when the pointer is moving fast (velocity), with enough distance in the allowed direction.
     */
    class SwipeRecognizer extends AttrRecognizer {
      static defaults = {
        event: 'swipe',
        threshold: 10,
        velocity: 0.3,
        direction: Direction.Horizontal | Direction.Vertical,
        pointers: 1
      }

      constructor(options?) {
        super(mergeOptions(options, SwipeRecognizer.defaults));
      }
    
      getTouchAction() {
        return PanRecognizer.prototype.getTouchAction.call(this);
      }
    
      attrTest(input) {
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

        return super.attrTest(input) 
          && direction & input.offsetDirection && input.distance > this.options.threshold 
          && input.maxPointers === this.options.pointers 
          && Math.abs(velocity) > this.options.velocity 
          && ((input.eventType & INPUT_END) !== 0);
      }

      emit(input) {
          var direction = directionStr(input.offsetDirection);
          if (direction) {
            this.manager.emit(this.options.event + direction, input);
          }
    
          this.manager.emit(this.options.event, input);
        }
    }
    
    /**
     * simple function bind
     */
    function bindFn(fn: Function, context: any): Function {
      return function boundFn() {
        return fn.apply(context, arguments);
      };
    }
    
    /**
     * set a timeout with a given scope
     */
    function setTimeoutContext(fn: Function, timeout: number, context: any): number{
      return setTimeout(bindFn(fn, context), timeout);
    }
    
    /**
     * calculate the absolute distance between two points
     * @param {Array} [props] containing x and y keys
     */
    function getDistance(p1: Point, p2: Point, props?): number {
      if (!props) {
        props = PROPS_XY;
      }
      var x = p2[props[0]] - p1[props[0]];
      var y = p2[props[1]] - p1[props[1]];
    
      return Math.sqrt(x * x + y * y);
    }
    
    /**
     * A tap is recognized when the pointer is doing a small tap/click. Multiple taps are recognized if they occur
     * between the given interval and position. The delay option can be used to recognize multi-taps without firing
     * a single tap.
     *
     * The eventData from the emitted event contains the property `tapCount`, which contains the amount of
     * multi-taps being recognized.
     */
    
    class TapRecognizer extends Recognizer {
      static defaults = {
        event: 'tap',
        pointers: 1,
        taps: 1,
        interval: 300, // max time between the multi-tap taps
        time: 250, // max time of the pointer to be down (like finger on the screen)
        threshold: 9, // a minimal movement is ok, but keep it low
        posThreshold: 10 // a multi-tap can be a bit off the initial position
      };

      count = 0;

      pTime = 0;
      pCenter: Point = { x: 0, y: 0 };

      _timer: any = null;
      _input: any = null;

      constructor(options?) {
        super(mergeOptions(options, TapRecognizer.defaults));
        
        // previous time and center,
        // used for tap counting
      }
    
      getTouchAction() {
        return [ 'manipulation' ];
      }

      process(input) : State {
        let validPointers = input.pointers.length === this.options.pointers;
        let validMovement = input.distance < this.options.threshold;
        let validTouchTime = input.deltaTime < this.options.time;

        this.reset();

        if (input.eventType & INPUT_START && this.count === 0) {
          return this.failTimeout();
        }

        // we only allow little movement
        // and we've reached an end event, so a tap is possible
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

          // if tap count matches we have recognized it,
          // else it has began recognizing...
          var tapCount = this.count % this.options.taps;
          if (tapCount === 0) {
            // no failing requirements, immediately trigger the tap event
            // or wait as long as the multitap interval to trigger
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
      }
    
      failTimeout() {
        this._timer = setTimeoutContext(() => {
          this.state = State.Failed;
        }, this.options.interval, this);

        return State.Failed;
      }

      reset() {
        clearTimeout(this._timer);
      }

      emit() {
        if (this.state === State.Recognized) {
          this._input.tapCount = this.count;
          this.manager.emit(this.options.event, this._input);
        }
      }
    }
    
    /**
     * Press
     * Recognized when the pointer is down for x ms without any movement.
     */
    class PressRecognizer extends Recognizer {  
      static defaults = {
        event: 'press',
        pointers: 1,
        time: 251, // minimal time of the pointer to be pressed
        threshold: 9 // a minimal movement is ok, but keep it low
      }

      _timer = null;
      _input = null;

      constructor(options) {
        super(mergeOptions(options, PressRecognizer.defaults));
      }

      getTouchAction() {
        return [TOUCH_ACTION_AUTO];
      }
    
      process(input): State {
        var validPointers = input.pointers.length === this.options.pointers;
        var validMovement = input.distance < this.options.threshold;
        var validTime = input.deltaTime > this.options.time;

        this._input = input;

        // we only allow little movement
        // and we've reached an end event, so a tap is possible
        if (!validMovement || !validPointers || input.eventType & (INPUT_END | INPUT_CANCEL) && !validTime) {
          this.reset();
        } 
        else if (input.eventType & INPUT_START) {
          this.reset();
          this._timer = setTimeoutContext(() => {
            this.state = State.Recognized;
            this.tryEmit();
          }, this.options.time, this);
        } 
        else if (input.eventType & INPUT_END) {
          return State.Recognized;
        }

        return State.Failed;
      }
      
      reset() {
        clearTimeout(this._timer);
      }
      
      emit(input) {
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
      }
    }
    
    /**
     * when the touchActions are collected they are not a valid value, so we need to clean things up. *
     * @returns {*}
     */
    function cleanTouchActions(actions: string) {
      // none

      if (actions.includes('none')) {
        return 'none';
      }
    
      var hasPanX = actions.includes('pan-x');
      var hasPanY = actions.includes('pan-y');
    
      // if both pan-x and pan-y are set (different recognizers
      // for different directions, e.g. horizontal pan but vertical swipe?)
      // we need none (as otherwise with pan-x pan-y combined none of these
      // recognizers will work, since the browser would handle all panning
      if (hasPanX && hasPanY) {
        return 'none';
      }
    
      // pan-x OR pan-y
      if (hasPanX || hasPanY) {
        return hasPanX ? 'pan-x' : 'pan-y';
      }
    
      // manipulation
      if (actions.includes('manipulation')) {
        return 'manipulation';
      }
    
      return TOUCH_ACTION_AUTO;
    }
    
    /**
     * Touch Action
     * sets the touchAction property or uses the js alternative
     */
    class TouchAction {
      manager: Manager;

      actions: string;

      constructor(manager: Manager, value: string) {
        this.manager = manager;
        this.set(value);
      }
    
      /**
       * set the touchAction value on the element or enable the polyfill
       */
      set(value: string) {
        // find out the touch-action by the event handlers
        if (value === 'compute') {
          value = this.compute();
        }

        if (supportsTouchAction && this.manager.element.style && TOUCH_ACTION_MAP[value]) {
          this.manager.element.style['touchAction'] = value;
        }
        this.actions = value.toLowerCase().trim();
      }
    
      /**
       * just re-set the touchAction value
       */
      update() {
        this.set(this.manager.options.touchAction);
      }
    
      /**
       * compute the value for the touchAction property based on the recognizer's settings
       */
      compute(): string {
        var actions = [];

        for (var recognizer of this.manager.recognizers) {
          if (boolOrFn(recognizer.options.enable, [recognizer])) {
            actions = actions.concat(recognizer.getTouchAction());
          }
        }
        return cleanTouchActions(actions.join(' '));
      }
    
      /**
       * this method is called on each input cycle and provides the preventing of the browser behavior
       */
      preventDefaults(input: any) {
        var srcEvent = input.srcEvent;

        var direction = input.offsetDirection;

        // if the touch action did prevented once this session
        if (this.manager.session.prevented) {
          srcEvent.preventDefault();
          return;
        }

        var actions = this.actions;

        var hasNone = actions.includes('none') && !TOUCH_ACTION_MAP['none'];
        var hasPanY = actions.includes('pan-y') && !TOUCH_ACTION_MAP['pan-y'];
        var hasPanX = actions.includes('pan-x') && !TOUCH_ACTION_MAP['pan-x'];

        if (hasNone) {
          // do not prevent defaults if this is a tap gesture
          var isTapPointer = input.pointers.length === 1;
          var isTapMovement = input.distance < 2;
          var isTapTouchTime = input.deltaTime < 250;

          if (isTapPointer && isTapMovement && isTapTouchTime) {
            return;
          }
        }

        if (hasPanX && hasPanY) {
          // `pan-x pan-y` means browser handles all scrolling/panning, do not prevent
          return;
        }

        if (hasNone || hasPanY && direction & Direction.Horizontal || hasPanX && direction & Direction.Vertical) {
          return this.preventSrc(srcEvent);
        }
      }
    
      /**
      * call preventDefault to prevent the browser's default behavior (scrolling in most cases)
      */
      preventSrc(srcEvent: Event) {
        this.manager.session.prevented = true;
        srcEvent.preventDefault();
      }
    }
    
    /**
     * find if a node is in the given parent
     */
    function hasParent(node: Node, parent: Node): boolean {
      while (node) {
        if (node === parent) {
          return true;
        }
        node = node.parentNode;
      }
      return false;
    }
    
    /**
     * get the center of all the pointers
     * @param {Array} pointers
     * @return {Object} center contains `x` and `y` properties
     */
    function getCenter(pointers) {
      var pointersLength = pointers.length;
    
      // no need to loop when only one touch
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
    
    /**
     * create a simple clone from the input used for storage of firstInput and firstMultiple
     * @returns {Object} clonedInputData
     */
    function simpleCloneInputData(input: any) {
      // make a simple copy of the pointers because we will get a reference if we don't
      // we only need clientXY for the calculations
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
    
    /**
     * calculate the angle between two coordinates
     * @param {Array} [props] containing x and y keys
     * @return {Number} angle
     */
    function getAngle(p1: any, p2: any, props?) {
      if (!props) {
        props = PROPS_XY;
      }
      var x = p2[props[0]] - p1[props[0]];
      var y = p2[props[1]] - p1[props[1]];
      return Math.atan2(y, x) * 180 / Math.PI;
    }
    
    /**
     * get the direction between two points
     */
    function getDirection(x: number, y: number) : Direction {
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
      // let { offsetDelta:offset = {}, prevDelta = {}, prevInput = {} } = session;
      // jscs throwing error on defalut destructured values and without defaults tests fail
    
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
    
    /**
     * calculate the velocity between two points. unit is in px per ms.
     * @return {Object} velocity `x` and `y`
     */
    function getVelocity(deltaTime: number, x: number, y: number) {
      return {
        x: x / deltaTime || 0,
        y: y / deltaTime || 0
      };
    }
    
    /**
     * calculate the scale factor between two pointersets
     * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
     * @param {Array} start array of pointers
     * @param {Array} end array of pointers
     * @return {Number} scale
     */
    function getScale(start, end) {
      return getDistance(end[0], end[1], PROPS_CLIENT_XY) / getDistance(start[0], start[1], PROPS_CLIENT_XY);
    }
    
    /**
     * calculate the rotation degrees between two pointersets
     * @param {Array} start array of pointers
     * @param {Array} end array of pointers
     * @return {Number} rotation
     */
    function getRotation(start, end) {
      return getAngle(end[1], end[0], PROPS_CLIENT_XY) + getAngle(start[1], start[0], PROPS_CLIENT_XY);
    }
    
    /**
     * velocity is calculated every x ms
     */
    function computeIntervalInputData(session: any, input: any) {
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
      } else {
        // use latest velocity info if it doesn't overtake a minimum period
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
    
    /**
     * extend the data with some usable properties like scale, rotate, velocity etc
     */
    function computeInputData(manager: Manager, input: any) {
      var session = manager.session;
      var pointers = input.pointers;
      var pointersLength = pointers.length;
    
      // store the first input to calculate the distance and direction
    
      if (!session.firstInput) {
        session.firstInput = simpleCloneInputData(input);
      }
    
      // to compute scale and rotation we need to store the multiple touches
      if (pointersLength > 1 && !session.firstMultiple) {
        session.firstMultiple = simpleCloneInputData(input);
      } else if (pointersLength === 1) {
        session.firstMultiple = false;
      }
    
      let firstInput = session.firstInput;
      let firstMultiple = session.firstMultiple;
    
      var offsetCenter = firstMultiple ? firstMultiple.center : firstInput.center;
    
      let center = input.center = getCenter(pointers);
      input.timeStamp = Date.now();
      input.deltaTime = input.timeStamp - firstInput.timeStamp;
    
      input.angle = getAngle(offsetCenter, center);
      input.distance = getDistance(offsetCenter, center);
    
      computeDeltaXY(session, input);
      input.offsetDirection = getDirection(input.deltaX, input.deltaY);
    
      let overallVelocity = getVelocity(input.deltaTime, input.deltaX, input.deltaY);
      input.overallVelocityX = overallVelocity.x;
      input.overallVelocityY = overallVelocity.y;
      input.overallVelocity = Math.abs(overallVelocity.x) > Math.abs(overallVelocity.y) ? overallVelocity.x : overallVelocity.y;
    
      input.scale = firstMultiple ? getScale(firstMultiple.pointers, pointers) : 1;
      input.rotation = firstMultiple ? getRotation(firstMultiple.pointers, pointers) : 0;
    
      input.maxPointers = !session.prevInput ? input.pointers.length : input.pointers.length > session.prevInput.maxPointers ? input.pointers.length : session.prevInput.maxPointers;
    
      computeIntervalInputData(session, input);
    
      // find the correct target
      let target = manager.element;
      if (hasParent(input.srcEvent.target, target)) {
        target = input.srcEvent.target;
      }
      input.target = target;
    }
    
    /**
     * handle input events
     */
    function inputHandler(manager: Manager, eventType, input: any) {
      let pointersLen = input.pointers.length;
      let changedPointersLen = input.changedPointers.length;
      let isFirst = eventType & INPUT_START && pointersLen - changedPointersLen === 0;
      let isFinal = eventType & (INPUT_END | INPUT_CANCEL) && pointersLen - changedPointersLen === 0;
    
      input.isFirst = !!isFirst;
      input.isFinal = !!isFinal;
    
      if (isFirst) {
        manager.session = {
          stopped: 0
        };
      }
    
      // source event is the normalized value of the domEvents
      // like 'touchstart, mouseup, pointerdown'
      input.eventType = eventType;
    
      // compute scale, rotation etc
      computeInputData(manager, input);
    
      // emit secret event
      manager.emit('hammer.input', input);
    
      manager.recognize(input);
      manager.session.prevInput = input;
    }
    
    /**
     * split string on whitespace
     */  
    function splitStr(text: string): Array<string> {
      return text.trim().split(/\s+/g);
    }
    
    /**
     * addEventListener with multiple events at once
     * @param {EventTarget} target
     */
    function addEventListeners(target, types: string, handler: Function) {
      for (var type of splitStr(types)) {
        target.addEventListener(type, handler, false);
      }
    }
    
    /**
     * removeEventListener with multiple events at once
     * @param {EventTarget} target
     */
    function removeEventListeners(target, types: string, handler: Function) {
      for (var type of splitStr(types)) {
        target.removeEventListener(type, handler, false);
      }
    }
    
    /**
     * get the window object of an element
     * @param {HTMLElement} element
     * @returns {DocumentView|Window}
     */
    function getWindowForElement(element){
      var doc = element.ownerDocument || element;
      return doc.defaultView || doc.parentWindow || window;
    }
    
    abstract class Input {
      manager: Manager;
      callback: any;
      element: any;
      target: any;
      domHandler: any;
      evEl: string;
      evTarget: string;
      evWin: string;

      constructor(manager: Manager, callback: Function) {
        this.manager = manager;
        this.callback = callback;
        this.element = manager.element;
        this.target = manager.options.inputTarget;
    
        // smaller wrapper around the handler, for the scope and the enabled state of the manager,
        // so when disabled the input events are completely bypassed.
        this.domHandler = ev => {
          
          if (boolOrFn(manager.options.enable, [manager])) {
            this.handler(ev);
          }
        };
      }

      /**
       * should handle the inputEvent data and trigger the callback
       */  
      abstract handler(ev);
    
      init() {
        this.evEl && addEventListeners(this.element, this.evEl, this.domHandler);
        this.evTarget && addEventListeners(this.target, this.evTarget, this.domHandler);
        this.evWin && addEventListeners(getWindowForElement(this.element), this.evWin, this.domHandler);
      }
    
      /**
       * unbind the events
       */  
      destroy() {
        this.evEl && removeEventListeners(this.element, this.evEl, this.domHandler);
        this.evTarget && removeEventListeners(this.target, this.evTarget, this.domHandler);
        this.evWin && removeEventListeners(getWindowForElement(this.element), this.evWin, this.domHandler);
      }
    }
    
    let POINTER_INPUT_MAP = {
      pointerdown: INPUT_START,
      pointermove: INPUT_MOVE,
      pointerup: INPUT_END,
      pointercancel: INPUT_CANCEL,
      pointerout: INPUT_CANCEL
    };
      
    /**
     * Pointer events input
     */
    class PointerEventInput extends Input {
      store: Array<PointerEvent>;

      constructor(manager: Manager, callback: Function) {
        super(manager, callback);
        
        this.evEl = 'pointerdown';
        this.evWin = 'pointermove pointerup pointercancel';
    
        this.store = this.manager.session.pointerEvents = [ ];

        this.init();
      }
    
      /**
       * handle mouse events
       */
      handler(ev: PointerEvent) {
        var removePointer = false;

        var eventTypeNormalized = ev.type.toLowerCase().replace('ms', '');
        var eventType = POINTER_INPUT_MAP[eventTypeNormalized];
        var pointerType = ev.pointerType;

        var isTouch = pointerType === 'touch';
        
        // get index of the event in the store
        var storeIndex = inArray(this.store, ev.pointerId, 'pointerId');

        // start and mouse must be down
        if (eventType & INPUT_START && (ev.button === 0 || isTouch)) {
          if (storeIndex < 0) {
            this.store.push(ev);
            storeIndex = this.store.length - 1;
          }
        } else if (eventType & (INPUT_END | INPUT_CANCEL)) {
          removePointer = true;
        }

        // it not found, so the pointer hasn't been down (so it's probably a hover)
        if (storeIndex < 0) {
          return;
        }

        // update the event in the store
        this.store[storeIndex] = ev;

        this.callback(this.manager, eventType, {
          pointers: this.store,
          changedPointers: [ev],
          pointerType: pointerType,
          srcEvent: ev
        });

        if (removePointer) {
          // remove from the store
          this.store.splice(storeIndex, 1);
        }
      }
    }
    

    
    /**
     * unique array with objects based on a key (like 'id') or just by the array's value
     * @param {Array} src [{id:1},{id:2},{id:1}]
     * @returns {Array} [{id:1},{id:2}]
     */
    function uniqueArray(src, key: string, sort = false) {
      var results = [];
      var values = [];
      var i = 0;
    
      while (i < src.length) {
        let val = key ? src[i][key] : src[i];
        if (inArray(values, val) < 0) {
          results.push(src[i]);
        }
        values[i] = val;
        i++;
      }
    
      if (sort) {
        if (!key) {
          results = results.sort();
        } else {
          results = results.sort(function (a, b) {
            return a[key] > b[key];
          });
        }
      }
    
      return results;
    }
    
    let TOUCH_INPUT_MAP = {
      touchstart: INPUT_START,
      touchmove: INPUT_MOVE,
      touchend: INPUT_END,
      touchcancel: INPUT_CANCEL
    };
    
    let TOUCH_TARGET_EVENTS = 'touchstart touchmove touchend touchcancel';
    
    /**
     * Multi-user touch events input
     */
    class TouchInput extends Input {
      targetIds: any;

      constructor(manager, callback) {
        super(manager, callback);
      
        this.evTarget = TOUCH_TARGET_EVENTS;
        this.targetIds = {};
        this.evTarget = TOUCH_TARGET_EVENTS;

        this.init();
      }
    
      handler(ev) {
        let type = TOUCH_INPUT_MAP[ev.type];
        let touches = getTouches.call(this, ev, type);
        
        if (!touches) {
          return;
        }

        this.callback(this.manager, type, {
          pointers: touches[0],
          changedPointers: touches[1],
          pointerType: 'touch',
          srcEvent: ev
        });
      }
    }
    
    function getTouches(ev, type) {
      let allTouches = Array.from(ev.touches);
      let targetIds = this.targetIds;
    
      // when there is only one touch, the process can be simplified
    
      if (type & (INPUT_START | INPUT_MOVE) && allTouches.length === 1) {
        targetIds[allTouches[0].identifier] = true;
        return [allTouches, allTouches];
      }
    
      let i = void 0;
      let targetTouches = void 0;
      let changedTouches = Array.from(ev.changedTouches);
      let changedTargetTouches = [];
      let target = this.target;
    
      // get target touches from touches
    
      targetTouches = allTouches.filter(function(touch) {
        return hasParent(touch.target, target);
      });
    
      // collect touches
      if (type === INPUT_START) {
        i = 0;
        while (i < targetTouches.length) {
          targetIds[targetTouches[i].identifier] = true;
          i++;
        }
      }
    
      // filter changed touches to only contain touches that exist in the collected target ids
      i = 0;
      while (i < changedTouches.length) {
        if (targetIds[changedTouches[i].identifier]) {
          changedTargetTouches.push(changedTouches[i]);
        }
    
        // cleanup removed touches
        if (type & (INPUT_END | INPUT_CANCEL)) {
          delete targetIds[changedTouches[i].identifier];
        }
        i++;
      }
    
      if (!changedTargetTouches.length) {
        return;
      }
    
      return [
      // merge targetTouches with changedTargetTouches so it contains ALL touches, including 'end' and 'cancel'
      uniqueArray(targetTouches.concat(changedTargetTouches), 'identifier', true), changedTargetTouches];
    }
    
    var MOUSE_INPUT_MAP = {
      mousedown: INPUT_START,
      mousemove: INPUT_MOVE,
      mouseup: INPUT_END
    };
    
    /**
     * Mouse events input
     */
    class MouseInput extends Input {
      pressed: boolean;

      constructor(manager, callback) {
        super(manager, callback);
        
        this.evEl = 'mousedown';
        this.evWin = 'mousemove mouseup';
    
        this.pressed = false; // mousedown state
        
        this.init();
      }

      /**
       * handle mouse events
       */  
      handler(ev: any) {
        var eventType = MOUSE_INPUT_MAP[ev.type];

        // on start we want to have the left mouse button down
        if (eventType & INPUT_START && ev.button === 0) {
          this.pressed = true;
        }

        if (eventType & INPUT_MOVE && ev.which !== 1) {
          eventType = INPUT_END;
        }

        // mouse must be down
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
      }
    }
    
    /**
     * Combined touch and mouse input
     *
     * Touch has a higher priority then mouse, and while touching no mouse events are allowed.
     * This because touch devices also emit mouse events while doing a touch.
     */
    
    let DEDUP_TIMEOUT = 2500;
    let DEDUP_DISTANCE = 25;
    
    class TouchMouseInput extends Input {
      touch: TouchInput;
      mouse: MouseInput;

      primaryTouch = null;
      lastTouches: Array<Point> = [ ];

      constructor(manager, callback) {
        super(manager,  callback);
        
        let handler = this.handler.bind(this);

        this.touch = new TouchInput(this.manager, handler);
        this.mouse = new MouseInput(this.manager, handler);

        this.init();
      }

      /**
       * handle mouse and touch events
       */
      handler(manager: Manager, inputEvent?: string, inputData?: any) {
        let isTouch = inputData.pointerType === 'touch';
        let isMouse = inputData.pointerType === 'mouse';

        if (isMouse && inputData.sourceCapabilities && inputData.sourceCapabilities.firesTouchEvents) {
          return;
        }

        // when we're in a touch event, record touches to  de-dupe synthetic mouse event
        if (isTouch) {
          recordTouches.call(this, inputEvent, inputData);
        } else if (isMouse && isSyntheticEvent.call(this, inputData)) {
          return;
        }

        this.callback(manager, inputEvent, inputData);
      }

      /**
       * remove the event listeners
       */
      destroy() {
        this.touch.destroy();
        this.mouse.destroy();
      }
      
    }
    
    function recordTouches(eventType, eventData) {
      if (eventType & INPUT_START) {
        this.primaryTouch = eventData.changedPointers[0].identifier;
        setLastTouch.call(this, eventData);
      } else if (eventType & (INPUT_END | INPUT_CANCEL)) {
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
      let x = eventData.srcEvent.clientX;
      let y = eventData.srcEvent.clientY;
      for (var i = 0; i < this.lastTouches.length; i++) {
        let t = this.lastTouches[i];
        let dx = Math.abs(x - t.x);
        let dy = Math.abs(y - t.y);
        if (dx <= DEDUP_DISTANCE && dy <= DEDUP_DISTANCE) {
          return true;
        }
      }
      return false;
    }
    
    /**
     * create new input type manager
     * called by the Manager constructor
     */
    function createInputInstance(manager: Manager): Input {
      var type = void 0;
      // let inputClass = manager.options.inputClass;
      var inputClass = manager.options.inputClass;
    
      if (inputClass) {
        type = inputClass;
      } 
      else if (supportsPointerEvents) {
        type = PointerEventInput;
      } 
      else if (supportsOnlyTouch) {
        type = TouchInput;
      } 
      else if (!supportsTouch) {
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
      
    interface Point {
      x: number;
      y: number;
    }

    interface Session {
      stopped?: number;
      curRecognizer?: any;
      firstInput?: any;
      firstMultiple?: any;
      prevInput?: any;
      pointerEvents?: any;
      prevented?: boolean;
    }

    interface Options {
      type?: string;
      recognizers?: Array<Recognizer>;
      inputTarget?: any;
      inputClass?: string;
      touchAction?: any;
      domEvents?: any;
      cssProps?: any;
      enable?: boolean;
    }

    export class Manager {
      options: Options = { };

      handlers: any = { };
      
      session: Session = { };

      recognizers: Array<Recognizer> = [];
      oldCssProps = {};

      input: any;
      element: HTMLElement;

      touchAction: TouchAction;

      constructor(element: HTMLElement, options?: Options) {
        this.options = mergeOptions(options, defaults);


        this.options.inputTarget = this.options.inputTarget || element;
    
        this.element = element;
        this.input = createInputInstance(this);
        this.touchAction = new TouchAction(this, this.options.touchAction);
    
        toggleCssProps(this, true);
        
        if (this.options.recognizers) {
          for (var item of this.options.recognizers) {
            let recognizer = this.add(new item[0](item[1])) as Recognizer;

            item[2] && recognizer.recognizeWith(item[2]);
            item[3] && recognizer.requireFailure(item[3]);
          }
        }
      }
    
      set(options): Manager {
        Object.assign(this.options, options);

        // Options that need a little more setup
        if (options.touchAction) {
          this.touchAction.update();
        }

        if (options.inputTarget) {
          // Clean up existing event listeners and reinitialize
          this.input.destroy();
          this.input.target = options.inputTarget;
          this.input.init();
        }
        
        return this;
      }
    
      /**
       * stop recognizing for this session.
       * This session will be discarded, when a new [input]start event is fired.
       * When forced, the recognizer cycle is stopped immediately.
       */
      stop(force: boolean) {
        this.session.stopped = force ? FORCED_STOP : STOP;
      }
    
      /**
       * run the recognizers!
       * called by the inputHandler function on every movement of the pointers (touches)
       * it walks through all the recognizers and tries to detect the gesture that is being made
       */
      recognize(inputData: any) {
        var session = this.session;

        if (session.stopped) {
          return;
        }

        // run the touch-action polyfill
        this.touchAction.preventDefaults(inputData);

        var recognizer = void 0;
        var recognizers = this.recognizers;

        // this holds the recognizer that is being recognized.
        // so the recognizer's state needs to be BEGAN, CHANGED, ENDED or RECOGNIZED
        // if no recognizer is detecting a thing, it is set to `null`

        var curRecognizer = session.curRecognizer;

        // reset when the last recognizer is recognized
        // or when we're in a new session

        if (!curRecognizer || curRecognizer && curRecognizer.state & State.Recognized) {
          curRecognizer = session.curRecognizer = null;
        }

        var i = 0;
        while (i < recognizers.length) {
          recognizer = recognizers[i];

          // find out if we are allowed try to recognize the input for this one.
          // 1.   allow if the session is NOT forced stopped (see the .stop() method)
          // 2.   allow if we still haven't recognized a gesture in this session, or the this recognizer is the one
          //      that is being recognized.
          // 3.   allow if the recognizer is allowed to run simultaneous with the current recognized recognizer.
          //      this can be setup with the `recognizeWith()` method on the recognizer.
          if (session.stopped !== FORCED_STOP && ( // 1
          !curRecognizer || recognizer === curRecognizer || // 2
          recognizer.canRecognizeWith(curRecognizer))) {
            // 3
            recognizer.recognize(inputData);
          } else {
            recognizer.reset();
          }

          // if the recognizer has been recognizing the input as a valid gesture, we want to store this one as the
          // current active recognizer. but only if we don't already have an active recognizer
          if (!curRecognizer && recognizer.state & (State.Began | State.Changed | State.Ended)) {
            curRecognizer = session.curRecognizer = recognizer;
          }
          i++;
        }
      }
    
      /**
       * get a recognizer by its event name.
       * @param {Recognizer|String} recognizer
       * @returns {Recognizer|Null}
       */
    
      get(recognizer) {
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
      }
    
      /**
       * add a recognizer to the manager
       * if an existing recognizer already exists, it will be removed first
       * existing recognizers with the same event name will be removed
       */
      add(recognizer: Recognizer): Recognizer | Manager {
        if (invokeArrayArg(recognizer, 'add', this)) {
          return this;
        }

        // remove existing
        var existing = this.get(recognizer.options.event);
        
        if (existing) {
          this.remove(existing);
        }

        this.recognizers.push(recognizer);

        recognizer.manager = this;

        this.touchAction.update();

        return recognizer;
      }

      /**
       * remove a recognizer by name or instance
       */
      remove(recognizer: Recognizer|string): Manager {
        if (invokeArrayArg(recognizer, 'remove', this)) {
          return this;
        }

        recognizer = this.get(recognizer);

        // let's make sure this recognizer exists
        if (recognizer) {
          var recognizers = this.recognizers;

          var index = inArray(recognizers, recognizer);

          if (index !== -1) {
            recognizers.splice(index, 1);
            this.touchAction.update();
          }
        }

        return this;
      }
    
      /**
       * bind event
       * @returns {EventEmitter} this
       */
    
      on(events: string, handler: Function) {
        if (events === undefined) {
          return;
        }
        if (handler === undefined) {
          return;
        }

        var handlers = this.handlers;

        for (var event of splitStr(events)) {
          handlers[event] = handlers[event] || [];
          handlers[event].push(handler);
        }
        
        return this;
      }

      /**
       * unbind event, leave emit blank to remove all handlers
       * @returns {EventEmitter} this
       */
      off(events: string, handler: Function) {
        if (events === undefined) {
          return;
        }

        var handlers = this.handlers;

        for (var event of splitStr(events)) {
          if (!handler) {
            delete handlers[event];
          } else {
            handlers[event] && handlers[event].splice(inArray(handlers[event], handler), 1);
          }
        }

        return this;
      }
    
      /**
       * emit event to the listeners
       */
      emit(eventType: string, data: any) {
        // we also want to trigger dom events
        if (this.options.domEvents) {
          triggerDomEvent(eventType, data);
        }

        // no handlers, so skip it all
        var handlers = this.handlers[eventType] && this.handlers[eventType].slice();
        if (!handlers || !handlers.length) {
          return;
        }

        data.type = event;
        data.preventDefault = function () {
          data.srcEvent.preventDefault();
        };

        var i = 0;
        while (i < handlers.length) {
          handlers[i](data);
          i++;
        }
      }
    
      /**
       * destroy the manager and unbinds all events
       * it doesn't unbind dom events, that is the user own responsibility
       */
      destroy() {
        this.element && toggleCssProps(this, false);

        this.handlers = { };
        
        this.session = {
          stopped: 0
        };

        this.input.destroy();
        this.element = null;
      }
    }
    
    function toggleCssProps(manager: Manager, add: boolean) {
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
        manager.oldCssProps = { };
      }
    }
    
    /**
     * trigger dom event
     */
    function triggerDomEvent(type: string, data: any) {
      var gestureEvent = document.createEvent('Event');
      gestureEvent.initEvent(type, true, true);
      gestureEvent.gesture = data;
      data.target.dispatchEvent(gestureEvent);
    }
    

    
    var SINGLE_TOUCH_INPUT_MAP = {
      touchstart: INPUT_START,
      touchmove: INPUT_MOVE,
      touchend: INPUT_END,
      touchcancel: INPUT_CANCEL
    };
    
    var SINGLE_TOUCH_TARGET_EVENTS = 'touchstart';
    var SINGLE_TOUCH_WINDOW_EVENTS = 'touchstart touchmove touchend touchcancel';
    
    /**
     * Touch events input
     */
    class SingleTouchInput extends Input {
      started: boolean;

      constructor(manager: Manager, callback) {
        super(manager, callback);
        this.evTarget = SINGLE_TOUCH_TARGET_EVENTS;
        this.evWin = SINGLE_TOUCH_WINDOW_EVENTS;
        this.started = false; 

        this.init();
      }
    
      handler(ev) {
        var type = SINGLE_TOUCH_INPUT_MAP[ev.type];

        // should we handle the touch events?
        if (type === INPUT_START) {
          this.started = true;
        }

        if (!this.started) {
          return;
        }

        var touches = normalizeSingleTouches.call(this, ev, type);

        // when done, reset the started state
        if (type & (INPUT_END | INPUT_CANCEL) && touches[0].length - touches[1].length === 0) {
          this.started = false;
        }

        this.callback(this.manager, type, {
          pointers: touches[0],
          changedPointers: touches[1],
          pointerType: 'touch',
          srcEvent: ev
        });
      }
    }
    
    function normalizeSingleTouches(ev, type) {
      var all = Array.from(ev.touches);
      var changed = Array.from(ev.changedTouches);
    
      if (type & (INPUT_END | INPUT_CANCEL)) {
        all = uniqueArray(all.concat(changed), 'identifier', true);
      }
    
      return [all, changed];
    } 


    let presets = [
      // RecognizerClass, options, [recognizeWith, ...], [requireFailure, ...]
      [ RotateRecognizer, { enable: false } ], 
      [ PinchRecognizer,  { enable: false }, ['rotate'] ], 
      [ SwipeRecognizer,  { direction: Direction.Horizontal }],
      [ PanRecognizer,    { direction: Direction.Horizontal }, [ 'swipe'] ], [ TapRecognizer ], 
      [ TapRecognizer,    { event: 'doubletap', taps: 2 }, [ 'tap' ] ], [ PressRecognizer ]
    ];

    let defaults = {
      domEvents: false,
    
      /**
       * The value for the touchAction property/fallback.
       * When set to `compute` it will magically set the correct value based on the added recognizers.
       */
      touchAction: 'compute',
      enable: true,
      inputTarget: null,
    
      /**
       * force an input class
       * @type {Null|Function}
       */
      inputClass: null,
    
      /**
       * Some CSS properties can be used to improve the working of Hammer.
       * Add them to this method and they will be set when creating a new Manager.
       * @namespace
       */
      cssProps: {
          /**
           * Disables text selection to improve the dragging gesture. Mainly for desktop browsers.
           */
          userSelect: 'none',
      
          /**
           * Disable the Windows Phone grippers when pressing an element.
           */
          touchSelect: 'none',
      
          /**
           * Disables the default callout shown when you touch and hold a touch target.
           * On iOS, when you touch and hold a touch target such as a link, Safari displays
           * a callout containing information about the link. This property allows you to disable that callout.
           */
          touchCallout: 'none',
      
          /**
           * Specifies whether zooming is enabled. Used by IE10>
           */
          contentZooming: 'none',
      
          /**
           * Specifies that an entire element should be draggable instead of its contents. Mainly for desktop browsers.
           */
          userDrag: 'none',
      
          /**
           * Overrides the highlight color shown when the user taps a link or a JavaScript
           * clickable element in iOS. This property obeys the alpha value, if specified.
           * @type {String}
           * @default 'rgba(0,0,0,0)'
           */
          tapHighlightColor: 'rgba(0,0,0,0)'
        }
      }

      export let Pan = PanRecognizer;
      export let Pinch = PinchRecognizer;
      export let Press = PressRecognizer;
      export let Rotate = RotateRecognizer;
      export let Swipe = SwipeRecognizer;
      export let Tap = TapRecognizer;
  }
}