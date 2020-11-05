import React, { useCallback, useEffect, useRef, useState } from "react";
import "./styles.css";

// ReactDom strangelly disable the log in between renders
// so if you wish to really log something outside
// of a uffect use this.
const consoleLog = console.log.bind(console);

// Counts all renders
const useRenderCount = () => {
  const renderRef = useRef(1);

  // We reset on hot reload
  useEffect(() => {
    renderRef.current = 1;
  }, []);

  useEffect(() => {
    const newCount = renderRef.current + 1;
    renderRef.current = newCount;
  });

  return renderRef.current;
};

// Counts all CALLS to the parent function
const useCallLogEffect = (prefix) => {
  const callCountRef = useRef(0);
  callCountRef.current++;
};

const makeRenderComp = () => ({ label }) => {
  const count = useRenderCount(label);
  useCallLogEffect(label);

  return (
    <div style={{ border: "1px solid red" }}>
      <h2> {label} </h2>
      <h3>Render count: {count}</h3>
    </div>
  );
};

const makeCallbackRenderComp = () => ({
  label,
  computation,
  subtitle,
  getSubtitleValue
}) => {
  const [state, setState] = useState(0);
  const renderCount = useRenderCount(label);
  useCallLogEffect(label);

  const updateState = useCallback(() => {
    setState(computation());
  }, [computation]);

  return (
    <div style={{ position: "relative", border: "1px solid red" }}>
      <h2> {label} </h2>
      <h3>Render count: {renderCount}</h3>
      <h3>Inner state: {state}</h3>
      {subtitle ? (
        <h3>
          {subtitle} {getSubtitleValue()}
        </h3>
      ) : null}
      <button
        style={{ position: "absolute", bottom: "10px", right: "10px" }}
        onClick={updateState}
      >
        Get root state to inner state
      </button>
    </div>
  );
};

const NotMemoized = makeRenderComp();
const Memoized = React.memo(NotMemoized);

const PropNotMemoized = makeCallbackRenderComp();
const PropMemoized = React.memo(PropNotMemoized);

export default function App() {
  const renderCount = useRenderCount("Root");
  const [counter, setCounter] = useState(0);

  const increaseCounter = useCallback(() => {
    setCounter((counter) => counter + 10);
  }, []);

  const instableOperation = () => {};

  const stableOperation = useCallback(
    (outterCounter) => {
      // some complex computation or api call
      return outterCounter ?? counter;
    },
    // depends on counter: counter changes -> new callback ref generated
    //
    // btw this is the way react team recommends the usage of the useCallback
    // with their linter.
    [counter]
  );

  const stableOperationWithBug = useCallback(() => {
    return stableOperation(counter);

    // no dependency, will only use the first ref to the first
    // render closure
  }, []);

  // This one is a hack way to make the callback stable
  // so we avoid unneeded renders (or HUGE dependency list)
  // by getting the needed dependency from a ref that always
  // point to the last call/render result/state
  const stateDepsRef = useRef();
  // always the latest call result.
  stateDepsRef.current = { stableOperation, counter };

  const hackyWayToMakeStable = useCallback(() => {
    return stateDepsRef.current.stableOperation(stateDepsRef.current.counter);

    // since we use a ref, we don't need to depend on it
    // (and trying to depend on it will not have the desided effects)
  }, []);

  // so, the problem with the above approach is that
  // you will need to change
  // innerDepsRef.current = { stableOperation, counter };
  // for every new state that you depend on, and also
  // you will need to be destructuring/accessing the .current prop
  //
  // To solve that we can use a ref to the callback itself
  // and use a stable callback to 'be seen' as the original callback
  const callbackRef = useRef();
  callbackRef.current = stableOperation;
  // we want to be 'seen as the original function
  // so we return whatever it returns and also receive whatever
  // it receives.
  const stableDelegateToRefOperation = useCallback((...args) => {
    return callbackRef.current(...args);

    //here we also get rid of that annoying deps array :D
  }, []);

  return (
    <div
      className="App"
      style={{ position: "relative", marginBottom: "142px" }}
    >
      <h2>Simple memoizations with no props:</h2>
      {/* This one will render at every state change */}
      <NotMemoized label={"Not memoized"} />

      {/* Since this is memoized, it will render once */}
      <Memoized label={"Memoized"} />

      <h2>Incorrect useCallback usages:</h2>

      {/* This one is memoized, but has a INSTABLE prop that
       * makes it render every time
       */}
      <Memoized
        label="Memoized with a INSTABLE callback"
        anything={instableOperation}
      />

      {/* Non memoized with a "buggy" callback that points
       * to the FIRST render closure (which points to the first
       *  render states)
       *
       * Note: be warned that live reload will affect this stability.
       */}
      <PropNotMemoized
        label="Not memoized with INCORRECT useCallback DEPS"
        computation={stableOperationWithBug}
      />

      <h2>Correct useCallback usages:</h2>
      {/* Memoized with a somehow stable callback
       * when a new callback is generated it will
       * re-render with the newest ref
       */}
      <PropMemoized
        label="Memoized with a STABLE callback"
        computation={stableOperation}
      />

      {/* Memoized, but with a callback that doesn't generate
       * new refs but still points to the latest render
       * 'state' (it's actually using a ref for this)
       */}
      <PropMemoized
        label={
          "Hacky way to make stable and take state from parent (prop refs)"
        }
        computation={hackyWayToMakeStable}
      />

      {/* Memoized, but with a callback that doesn't generate
       * new refs but still points to the latest render
       * 'state' (it's actually using a ref for this)
       */}
      <PropMemoized
        label={
          "Hacky way to make stable and take state from parent (function ref)"
        }
        computation={stableDelegateToRefOperation}
      />

      <h2>Caveats of the hacky way:</h2>
      {/* There's a problem when it comes to return something for
       * RENDERING with the hacky approach, a memoized component
       * will not see a callback change:
       */}
      <PropMemoized
        label="Problem with the hacky way"
        subtitle="Direct callback result from parent"
        getSubtitleValue={stableDelegateToRefOperation}
        computation={stableDelegateToRefOperation}
      />

      {/* To fix that, you either useMemo for the render result or
       * use a callback with proper stable props
       */}
      <PropMemoized
        label="Proper 'fix' for above problem"
        subtitle="Direct callback result from parent"
        getSubtitleValue={stableOperation}
        computation={stableDelegateToRefOperation}
      />

      <div
        style={{
          background: "#5bc756",
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-around",
          position: "fixed",
          padding: "8px 16px",
          bottom: "0px",
          left: "0px",
          right: "0px"
        }}
      >
        <h2>Root render count {renderCount}</h2>
        <button onClick={increaseCounter}>Increase state</button>
        <h2>State: {counter}</h2>
      </div>
    </div>
  );
}
