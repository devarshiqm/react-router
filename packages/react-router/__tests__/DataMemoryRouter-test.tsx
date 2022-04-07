import * as React from "react";
import {
  render,
  fireEvent,
  waitFor,
  screen,
  prettyDOM,
  queryByText,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import type { FormMethod, Router } from "@remix-run/router";
import { createMemoryRouter } from "@remix-run/router";

import type { DataMemoryRouterProps } from "../index";
import {
  DataMemoryRouter,
  Route,
  Outlet,
  useActionData,
  useLoaderData,
  useMatches,
  useRouteLoaderData,
  useRouteException,
  useNavigation,
  useRevalidator,
  UNSAFE_DataRouterContext,
  MemoryRouter,
  Routes,
  UNSAFE_useRenderDataRouter,
} from "../index";

describe("<DataMemoryRouter>", () => {
  let consoleWarn: jest.SpyInstance;
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });

  it("renders the first route that matches the URL", () => {
    let { container } = render(
      <DataMemoryRouter initialEntries={["/"]} hydrationData={{}}>
        <Route path="/" element={<h1>Home</h1>} />
      </DataMemoryRouter>
    );

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Home
        </h1>
      </div>"
    `);
  });

  it("accepts routes as a prop instead of children", () => {
    let routes = [
      {
        path: "/",
        element: <h1>Home</h1>,
      },
    ];
    let { container } = render(
      <DataMemoryRouter
        initialEntries={["/"]}
        hydrationData={{}}
        todo_bikeshed_routes={routes}
      />
    );

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Home
        </h1>
      </div>"
    `);
  });

  it("renders the first route that matches the URL when a basename exists", () => {
    let { container } = render(
      <DataMemoryRouter
        basename="/base"
        initialEntries={["/base/thing"]}
        hydrationData={{}}
      >
        <Route path="/" element={<Outlet />}>
          <Route path="thing" element={<h1>Heyooo</h1>} />
        </Route>
      </DataMemoryRouter>
    );

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Heyooo
        </h1>
      </div>"
    `);
  });

  it("renders with hydration data", async () => {
    let { container } = render(
      <DataMemoryRouter
        initialEntries={["/child"]}
        hydrationData={{
          loaderData: {
            "0": "parent data",
            "0-0": "child data",
          },
          actionData: {
            "0-0": "child action",
          },
        }}
      >
        <Route path="/" element={<Comp />}>
          <Route path="child" element={<Comp />} />
        </Route>
      </DataMemoryRouter>
    );

    function Comp() {
      let data = useLoaderData();
      let actionData = useActionData();
      let transition = useNavigation();
      return (
        <div>
          {data}
          {actionData}
          {transition.state}
          <Outlet />
        </div>
      );
    }

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <div>
          parent data
          child action
          idle
          <div>
            child data
            child action
            idle
          </div>
        </div>
      </div>"
    `);
  });

  it("renders fallbackElement while first data fetch happens", async () => {
    let fooDefer = defer();
    let { container } = render(
      <DataMemoryRouter
        initialEntries={["/foo"]}
        fallbackElement={<FallbackElement />}
      >
        <Route path="/" element={<Outlet />}>
          <Route path="foo" loader={() => fooDefer.promise} element={<Foo />} />
          <Route path="bar" element={<Bar />} />
        </Route>
      </DataMemoryRouter>
    );

    function FallbackElement() {
      return <p>Loading...</p>;
    }

    function Foo() {
      let data = useLoaderData();
      return <h1>Foo:{data?.message}</h1>;
    }

    function Bar() {
      return <h1>Bar Heading</h1>;
    }

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <p>
          Loading...
        </p>
      </div>"
    `);

    fooDefer.resolve({ message: "From Foo Loader" });
    await waitFor(() => screen.getByText("Foo:From Foo Loader"));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Foo:
          From Foo Loader
        </h1>
      </div>"
    `);
  });

  it("renders a default fallbackElement if none is provided", async () => {
    let fooDefer = defer();
    let { container } = render(
      <DataMemoryRouter initialEntries={["/foo"]}>
        <Route path="/" element={<Outlet />}>
          <Route path="foo" loader={() => fooDefer.promise} element={<Foo />} />
          <Route path="bar" element={<Bar />} />
        </Route>
      </DataMemoryRouter>
    );

    function Foo() {
      let data = useLoaderData();
      return <h1>Foo:{data?.message}</h1>;
    }

    function Bar() {
      return <h1>Bar Heading</h1>;
    }

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <div
          class=\\"ghost\\"
        >
          👻
        </div>
      </div>"
    `);

    fooDefer.resolve({ message: "From Foo Loader" });
    await waitFor(() => screen.getByText("Foo:From Foo Loader"));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Foo:
          From Foo Loader
        </h1>
      </div>"
    `);
  });

  it("does not render fallbackElement if no data fetch is required", async () => {
    let fooDefer = defer();
    let { container } = render(
      <DataMemoryRouter
        initialEntries={["/bar"]}
        fallbackElement={<FallbackElement />}
      >
        <Route path="/" element={<Outlet />}>
          <Route path="foo" loader={() => fooDefer.promise} element={<Foo />} />
          <Route path="bar" element={<Bar />} />
        </Route>
      </DataMemoryRouter>
    );

    function FallbackElement() {
      return <p>Loading...</p>;
    }

    function Foo() {
      let data = useLoaderData();
      return <h1>Foo:{data?.message}</h1>;
    }

    function Bar() {
      return <h1>Bar Heading</h1>;
    }

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <h1>
          Bar Heading
        </h1>
      </div>"
    `);
  });

  it("handles link navigations", async () => {
    render(
      <DataMemoryRouter initialEntries={["/foo"]} hydrationData={{}}>
        <Route path="/" element={<Layout />}>
          <Route path="foo" element={<Foo />} />
          <Route path="bar" element={<Bar />} />
        </Route>
      </DataMemoryRouter>
    );

    function Layout() {
      return (
        <div>
          <MemoryNavigate to="/foo">Link to Foo</MemoryNavigate>
          <MemoryNavigate to="/bar">Link to Bar</MemoryNavigate>
          <Outlet />
        </div>
      );
    }

    function Foo() {
      return <h1>Foo Heading</h1>;
    }

    function Bar() {
      return <h1>Bar Heading</h1>;
    }

    expect(screen.getByText("Foo Heading")).toBeDefined();
    fireEvent.click(screen.getByText("Link to Bar"));
    await waitFor(() => screen.getByText("Bar Heading"));

    fireEvent.click(screen.getByText("Link to Foo"));
    await waitFor(() => screen.getByText("Foo Heading"));
  });

  it("executes route loaders on navigation", async () => {
    let barDefer = defer();

    let { container } = render(
      <DataMemoryRouter initialEntries={["/foo"]} hydrationData={{}}>
        <Route path="/" element={<Layout />}>
          <Route path="foo" element={<Foo />} />
          <Route path="bar" loader={() => barDefer.promise} element={<Bar />} />
        </Route>
      </DataMemoryRouter>
    );

    function Layout() {
      let transition = useNavigation();
      return (
        <div>
          <MemoryNavigate to="/bar">Link to Bar</MemoryNavigate>
          <p>{transition.state}</p>
          <Outlet />
        </div>
      );
    }

    function Foo() {
      return <h1>Foo</h1>;
    }
    function Bar() {
      let data = useLoaderData();
      return <h1>{data?.message}</h1>;
    }

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <div>
          <a
            href=\\"/bar\\"
          >
            Link to Bar
          </a>
          <p>
            idle
          </p>
          <h1>
            Foo
          </h1>
        </div>
      </div>"
    `);

    fireEvent.click(screen.getByText("Link to Bar"));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <div>
          <a
            href=\\"/bar\\"
          >
            Link to Bar
          </a>
          <p>
            loading
          </p>
          <h1>
            Foo
          </h1>
        </div>
      </div>"
    `);

    barDefer.resolve({ message: "Bar Loader" });
    await waitFor(() => screen.getByText("idle"));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <div>
          <a
            href=\\"/bar\\"
          >
            Link to Bar
          </a>
          <p>
            idle
          </p>
          <h1>
            Bar Loader
          </h1>
        </div>
      </div>"
    `);
  });

  it("executes route actions/loaders on submission navigations", async () => {
    let barDefer = defer();
    let barActionDefer = defer();
    let formData = new FormData();
    formData.append("test", "value");

    let { container } = render(
      <DataMemoryRouter initialEntries={["/foo"]} hydrationData={{}}>
        <Route path="/" element={<Layout />}>
          <Route path="foo" element={<Foo />} />
          <Route
            path="bar"
            action={() => barActionDefer.promise}
            loader={() => barDefer.promise}
            element={<Bar />}
          />
        </Route>
      </DataMemoryRouter>
    );

    function Layout() {
      let transition = useNavigation();
      return (
        <div>
          <MemoryNavigate to="/bar" formMethod="post" formData={formData}>
            Post to Bar
          </MemoryNavigate>
          <p>{transition.state}</p>
          <Outlet />
        </div>
      );
    }

    function Foo() {
      return <h1>Foo</h1>;
    }
    function Bar() {
      let data = useLoaderData();
      let actionData = useActionData();
      return (
        <h1>
          {data}
          {actionData}
        </h1>
      );
    }

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <div>
          <form>
            Post to Bar
          </form>
          <p>
            idle
          </p>
          <h1>
            Foo
          </h1>
        </div>
      </div>"
    `);

    fireEvent.click(screen.getByText("Post to Bar"));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <div>
          <form>
            Post to Bar
          </form>
          <p>
            submitting
          </p>
          <h1>
            Foo
          </h1>
        </div>
      </div>"
    `);

    barActionDefer.resolve("Bar Action");
    await waitFor(() => screen.getByText("loading"));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <div>
          <form>
            Post to Bar
          </form>
          <p>
            loading
          </p>
          <h1>
            Foo
          </h1>
        </div>
      </div>"
    `);

    barDefer.resolve("Bar Loader");
    await waitFor(() => screen.getByText("idle"));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <div>
          <form>
            Post to Bar
          </form>
          <p>
            idle
          </p>
          <h1>
            Bar Loader
            Bar Action
          </h1>
        </div>
      </div>"
    `);
  });

  it("provides useMatches and useRouteLoaderData", async () => {
    let spy = jest.fn();

    render(
      <DataMemoryRouter initialEntries={["/"]} hydrationData={{}}>
        <Route path="/" element={<Layout />}>
          <Route
            path="foo"
            loader={async () => "FOO LOADER"}
            element={<Foo />}
          />
          <Route
            path="bar"
            loader={async () => "BAR LOADER"}
            element={<Bar />}
          />
        </Route>
      </DataMemoryRouter>
    );

    function Layout() {
      spy({
        component: "Layout",
        useMatches: useMatches(),
        useRouteLoaderData: useRouteLoaderData("0"),
      });
      return (
        <div>
          <MemoryNavigate to="/bar">Link to Bar</MemoryNavigate>
          <Outlet />
        </div>
      );
    }

    function Foo() {
      spy({
        component: "Foo",
        useMatches: useMatches(),
        useRouteLoaderData: useRouteLoaderData("0-0"),
      });
      return <h1>Foo</h1>;
    }
    function Bar() {
      spy({
        component: "Bar",
        useMatches: useMatches(),
        useRouteLoaderData: useRouteLoaderData("0-1"),
      });
      return <h1>Bar</h1>;
    }

    expect(spy.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        Object {
          "component": "Layout",
          "useMatches": Array [
            Object {
              "data": undefined,
              "id": "0",
              "params": Object {},
              "pathname": "/",
            },
          ],
          "useRouteLoaderData": undefined,
        },
      ]
    `);
    expect(spy.mock.calls.length).toBe(1);
    fireEvent.click(screen.getByText("Link to Bar"));
    expect(spy.mock.calls[1]).toMatchInlineSnapshot(`
      Array [
        Object {
          "component": "Layout",
          "useMatches": Array [
            Object {
              "data": undefined,
              "id": "0",
              "params": Object {},
              "pathname": "/",
            },
          ],
          "useRouteLoaderData": undefined,
        },
      ]
    `);
    expect(spy.mock.calls.length).toBe(2);
    await waitFor(() => screen.getByText("Bar"));
    expect(spy.mock.calls[2]).toMatchInlineSnapshot(`
      Array [
        Object {
          "component": "Layout",
          "useMatches": Array [
            Object {
              "data": undefined,
              "id": "0",
              "params": Object {},
              "pathname": "/",
            },
            Object {
              "data": "BAR LOADER",
              "id": "0-1",
              "params": Object {},
              "pathname": "/bar",
            },
          ],
          "useRouteLoaderData": undefined,
        },
      ]
    `);
    expect(spy.mock.calls[3]).toMatchInlineSnapshot(`
      Array [
        Object {
          "component": "Bar",
          "useMatches": Array [
            Object {
              "data": undefined,
              "id": "0",
              "params": Object {},
              "pathname": "/",
            },
            Object {
              "data": "BAR LOADER",
              "id": "0-1",
              "params": Object {},
              "pathname": "/bar",
            },
          ],
          "useRouteLoaderData": "BAR LOADER",
        },
      ]
    `);
    expect(spy.mock.calls.length).toBe(4);
  });

  it("reloads data using useRevalidate", async () => {
    let count = 1;

    let { container } = render(
      <DataMemoryRouter
        initialEntries={["/foo"]}
        hydrationData={{
          loaderData: {
            "0-0": "count=1",
          },
        }}
      >
        <Route path="/" element={<Layout />}>
          <Route
            path="foo"
            loader={async () => `count=${++count}`}
            element={<Foo />}
          />
        </Route>
      </DataMemoryRouter>
    );

    function Layout() {
      let transition = useNavigation();
      let { revalidate, state } = useRevalidator();
      return (
        <div>
          <button
            onClick={() => {
              debugger;
              revalidate();
            }}
          >
            Revalidate
          </button>
          <p>{transition.state}</p>
          <p>{state}</p>
          <Outlet />
        </div>
      );
    }

    function Foo() {
      let data = useLoaderData();
      return <p>{data}</p>;
    }

    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <div>
          <button>
            Revalidate
          </button>
          <p>
            idle
          </p>
          <p>
            idle
          </p>
          <p>
            count=1
          </p>
        </div>
      </div>"
    `);

    fireEvent.click(screen.getByText("Revalidate"));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <div>
          <button>
            Revalidate
          </button>
          <p>
            idle
          </p>
          <p>
            loading
          </p>
          <p>
            count=1
          </p>
        </div>
      </div>"
    `);

    await waitFor(() => screen.getByText("count=2"));
    expect(getHtml(container)).toMatchInlineSnapshot(`
      "<div>
        <div>
          <button>
            Revalidate
          </button>
          <p>
            idle
          </p>
          <p>
            idle
          </p>
          <p>
            count=2
          </p>
        </div>
      </div>"
    `);
  });

  describe("exceptions", () => {
    it("renders hydration exceptions on leaf elements", async () => {
      let { container } = render(
        <DataMemoryRouter
          initialEntries={["/child"]}
          hydrationData={{
            loaderData: {
              "0": "parent data",
            },
            actionData: {
              "0": "parent action",
            },
            exceptions: {
              "0-0": new Error("Kaboom 💥"),
            },
          }}
        >
          <Route path="/" element={<Comp />}>
            <Route
              path="child"
              element={<Comp />}
              exceptionElement={<ErrorBoundary />}
            />
          </Route>
        </DataMemoryRouter>
      );

      function Comp() {
        let data = useLoaderData();
        let actionData = useActionData();
        let transition = useNavigation();
        return (
          <div>
            {data}
            {actionData}
            {transition.state}
            <Outlet />
          </div>
        );
      }

      function ErrorBoundary() {
        let error = useRouteException();
        return <p>{error.message}</p>;
      }

      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <div>
            parent data
            parent action
            idle
            <p>
              Kaboom 💥
            </p>
          </div>
        </div>"
      `);
    });

    it("renders hydration exceptions on parent elements", async () => {
      let { container } = render(
        <DataMemoryRouter
          initialEntries={["/child"]}
          hydrationData={{
            loaderData: {},
            actionData: null,
            exceptions: {
              "0": new Error("Kaboom 💥"),
            },
          }}
        >
          <Route
            path="/"
            element={<Comp />}
            exceptionElement={<ErrorBoundary />}
          >
            <Route path="child" element={<Comp />} />
          </Route>
        </DataMemoryRouter>
      );

      function Comp() {
        let data = useLoaderData();
        let actionData = useActionData();
        let transition = useNavigation();
        return (
          <div>
            {data}
            {actionData}
            {transition.state}
            <Outlet />
          </div>
        );
      }

      function ErrorBoundary() {
        let error = useRouteException();
        return <p>{error.message}</p>;
      }

      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <p>
            Kaboom 💥
          </p>
        </div>"
      `);
    });

    it("renders navigation exceptions on leaf elements", async () => {
      let fooDefer = defer();
      let barDefer = defer();

      let { container } = render(
        <DataMemoryRouter
          initialEntries={["/foo"]}
          hydrationData={{
            loaderData: {
              "0-0": {
                message: "hydrated from foo",
              },
            },
          }}
        >
          <Route path="/" element={<Layout />}>
            <Route
              path="foo"
              loader={() => fooDefer.promise}
              element={<Foo />}
              exceptionElement={<FooException />}
            />
            <Route
              path="bar"
              loader={() => barDefer.promise}
              element={<Bar />}
              exceptionElement={<BarException />}
            />
          </Route>
        </DataMemoryRouter>
      );

      function Layout() {
        let transition = useNavigation();
        return (
          <div>
            <MemoryNavigate to="/foo">Link to Foo</MemoryNavigate>
            <MemoryNavigate to="/bar">Link to Bar</MemoryNavigate>
            <p>{transition.state}</p>
            <Outlet />
          </div>
        );
      }

      function Foo() {
        let data = useLoaderData();
        return <h1>Foo:{data?.message}</h1>;
      }
      function FooException() {
        let exception = useRouteException();
        return <p>Foo Exception:{exception.message}</p>;
      }
      function Bar() {
        let data = useLoaderData();
        return <h1>Bar:{data?.message}</h1>;
      }
      function BarException() {
        let exception = useRouteException();
        return <p>Bar Exception:{exception.message}</p>;
      }

      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <div>
            <a
              href=\\"/foo\\"
            >
              Link to Foo
            </a>
            <a
              href=\\"/bar\\"
            >
              Link to Bar
            </a>
            <p>
              idle
            </p>
            <h1>
              Foo:
              hydrated from foo
            </h1>
          </div>
        </div>"
      `);

      fireEvent.click(screen.getByText("Link to Bar"));
      barDefer.reject(new Error("Kaboom!"));
      await waitFor(() => screen.getByText("idle"));
      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <div>
            <a
              href=\\"/foo\\"
            >
              Link to Foo
            </a>
            <a
              href=\\"/bar\\"
            >
              Link to Bar
            </a>
            <p>
              idle
            </p>
            <p>
              Bar Exception:
              Kaboom!
            </p>
          </div>
        </div>"
      `);

      fireEvent.click(screen.getByText("Link to Foo"));
      fooDefer.reject(new Error("Kaboom!"));
      await waitFor(() => screen.getByText("idle"));
      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <div>
            <a
              href=\\"/foo\\"
            >
              Link to Foo
            </a>
            <a
              href=\\"/bar\\"
            >
              Link to Bar
            </a>
            <p>
              idle
            </p>
            <p>
              Foo Exception:
              Kaboom!
            </p>
          </div>
        </div>"
      `);
    });

    it("renders navigation exceptions on parent elements", async () => {
      let fooDefer = defer();
      let barDefer = defer();

      let { container } = render(
        <DataMemoryRouter
          initialEntries={["/foo"]}
          hydrationData={{
            loaderData: {
              "0-0": {
                message: "hydrated from foo",
              },
            },
          }}
        >
          <Route
            path="/"
            element={<Layout />}
            exceptionElement={<LayoutException />}
          >
            <Route
              path="foo"
              loader={() => fooDefer.promise}
              element={<Foo />}
              exceptionElement={<FooException />}
            />
            <Route
              path="bar"
              loader={() => barDefer.promise}
              element={<Bar />}
            />
          </Route>
        </DataMemoryRouter>
      );

      function Layout() {
        let transition = useNavigation();
        return (
          <div>
            <MemoryNavigate to="/foo">Link to Foo</MemoryNavigate>
            <MemoryNavigate to="/bar">Link to Bar</MemoryNavigate>
            <p>{transition.state}</p>
            <Outlet />
          </div>
        );
      }
      function LayoutException() {
        let exception = useRouteException();
        return <p>Layout Exception:{exception.message}</p>;
      }
      function Foo() {
        let data = useLoaderData();
        return <h1>Foo:{data?.message}</h1>;
      }
      function FooException() {
        let exception = useRouteException();
        return <p>Foo Exception:{exception.message}</p>;
      }
      function Bar() {
        let data = useLoaderData();
        return <h1>Bar:{data?.message}</h1>;
      }

      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <div>
            <a
              href=\\"/foo\\"
            >
              Link to Foo
            </a>
            <a
              href=\\"/bar\\"
            >
              Link to Bar
            </a>
            <p>
              idle
            </p>
            <h1>
              Foo:
              hydrated from foo
            </h1>
          </div>
        </div>"
      `);

      fireEvent.click(screen.getByText("Link to Bar"));
      barDefer.reject(new Error("Kaboom!"));
      await waitFor(() => screen.getByText("Layout Exception:Kaboom!"));
      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <p>
            Layout Exception:
            Kaboom!
          </p>
        </div>"
      `);
    });

    it("renders navigation exceptions with a default if no exceptionElements are provided", async () => {
      let fooDefer = defer();
      let barDefer = defer();

      let { container } = render(
        <DataMemoryRouter
          initialEntries={["/foo"]}
          hydrationData={{
            loaderData: {
              "0-0": {
                message: "hydrated from foo",
              },
            },
          }}
        >
          <Route path="/" element={<Layout />}>
            <Route
              path="foo"
              loader={() => fooDefer.promise}
              element={<Foo />}
            />
            <Route
              path="bar"
              loader={() => barDefer.promise}
              element={<Bar />}
            />
          </Route>
        </DataMemoryRouter>
      );

      function Layout() {
        let transition = useNavigation();
        return (
          <div>
            <MemoryNavigate to="/foo">Link to Foo</MemoryNavigate>
            <MemoryNavigate to="/bar">Link to Bar</MemoryNavigate>
            <p>{transition.state}</p>
            <Outlet />
          </div>
        );
      }
      function Foo() {
        let data = useLoaderData();
        return <h1>Foo:{data?.message}</h1>;
      }
      function Bar() {
        let data = useLoaderData();
        return <h1>Bar:{data?.message}</h1>;
      }

      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <div>
            <a
              href=\\"/foo\\"
            >
              Link to Foo
            </a>
            <a
              href=\\"/bar\\"
            >
              Link to Bar
            </a>
            <p>
              idle
            </p>
            <h1>
              Foo:
              hydrated from foo
            </h1>
          </div>
        </div>"
      `);

      fireEvent.click(screen.getByText("Link to Bar"));
      let error = new Error("Kaboom!");
      error.stack = "FAKE STACK TRACE";
      barDefer.reject(error);
      await waitFor(() => screen.getByText("Kaboom!"));
      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <h2>
            Unhandled Thrown Exception!
          </h2>
          <p
            style=\\"font-style: italic;\\"
          >
            Kaboom!
          </p>
          <pre
            style=\\"padding: 0.5rem; background-color: rgba(200, 200, 200, 0.5);\\"
          >
            FAKE STACK TRACE
          </pre>
          <p>
            💿 Hey developer 👋
          </p>
          <p>
            You can provide a way better UX than this when your app throws errors by providing your own 
            <code
              style=\\"padding: 2px 4px; background-color: rgba(200, 200, 200, 0.5);\\"
            >
              exceptionElement
            </code>
             props on 
            <code
              style=\\"padding: 2px 4px; background-color: rgba(200, 200, 200, 0.5);\\"
            >
              &lt;Route&gt;
            </code>
          </p>
        </div>"
      `);
    });

    it("handles render errors in parent exceptionElement", async () => {
      let { container } = render(
        <DataMemoryRouter
          initialEntries={["/child"]}
          hydrationData={{
            loaderData: {},
            actionData: null,
          }}
        >
          <Route
            path="/"
            element={
              <div>
                <h1>This should not show</h1>
                <Outlet />
              </div>
            }
            exceptionElement={<ErrorBoundary />}
          >
            <Route path="child" element={<ChildComp />} />
          </Route>
        </DataMemoryRouter>
      );

      function ChildComp(): React.ReactElement {
        throw new Error("Kaboom!");
      }

      function ErrorBoundary() {
        let error = useRouteException();
        return <p>{error.message}</p>;
      }

      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <p>
            Kaboom!
          </p>
        </div>"
      `);
    });

    it("handles render errors in child exceptionElement", async () => {
      let { container } = render(
        <DataMemoryRouter
          initialEntries={["/child"]}
          hydrationData={{
            loaderData: {},
            actionData: null,
          }}
        >
          <Route
            path="/"
            element={
              <div>
                <h1>Parent</h1>
                <Outlet />
              </div>
            }
            exceptionElement={<p>Don't show this</p>}
          >
            <Route
              path="child"
              element={<ChildComp />}
              exceptionElement={<ErrorBoundary />}
            />
          </Route>
        </DataMemoryRouter>
      );

      function ChildComp(): React.ReactElement {
        throw new Error("Kaboom!");
      }

      function ErrorBoundary() {
        let error = useRouteException();
        return <p>{error.message}</p>;
      }

      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <div>
            <h1>
              Parent
            </h1>
            <p>
              Kaboom!
            </p>
          </div>
        </div>"
      `);
    });

    it("handles render errors in default exceptionElement", async () => {
      let { container } = render(
        <DataMemoryRouter
          initialEntries={["/child"]}
          hydrationData={{
            loaderData: {},
            actionData: null,
          }}
        >
          <Route
            path="/"
            element={
              <div>
                <h1>Parent</h1>
                <Outlet />
              </div>
            }
          >
            <Route path="child" element={<ChildComp />} />
          </Route>
        </DataMemoryRouter>
      );

      function ChildComp(): React.ReactElement {
        let error = new Error("Kaboom!");
        error.stack = "FAKE STACK TRACE";
        throw error;
      }

      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <h2>
            Unhandled Thrown Exception!
          </h2>
          <p
            style=\\"font-style: italic;\\"
          >
            Kaboom!
          </p>
          <pre
            style=\\"padding: 0.5rem; background-color: rgba(200, 200, 200, 0.5);\\"
          >
            FAKE STACK TRACE
          </pre>
          <p>
            💿 Hey developer 👋
          </p>
          <p>
            You can provide a way better UX than this when your app throws errors by providing your own 
            <code
              style=\\"padding: 2px 4px; background-color: rgba(200, 200, 200, 0.5);\\"
            >
              exceptionElement
            </code>
             props on 
            <code
              style=\\"padding: 2px 4px; background-color: rgba(200, 200, 200, 0.5);\\"
            >
              &lt;Route&gt;
            </code>
          </p>
        </div>"
      `);
    });

    it("does not handle render errors for non-data routers", async () => {
      expect(() =>
        render(
          <MemoryRouter initialEntries={["/child"]}>
            <Routes>
              <Route
                path="/"
                element={
                  <div>
                    <h1>Parent</h1>
                    <Outlet />
                  </div>
                }
              >
                <Route path="child" element={<ChildComp />} />
              </Route>
            </Routes>
          </MemoryRouter>
        )
      ).toThrowErrorMatchingInlineSnapshot(`"Kaboom!"`);

      function ChildComp(): React.ReactElement {
        throw new Error("Kaboom!");
      }
    });

    it("handles back button routing away from a child error boundary", async () => {
      let router: Router;

      // Need this to capture a copy of the router so we can trigger a back
      // navigation from _outside_ the DataMemoryRouter scope to most closely
      // resemble a browser back button
      function LocalDataMemoryRouter({
        basename,
        children,
        initialEntries,
        initialIndex,
        hydrationData,
        fallbackElement,
        todo_bikeshed_routes,
      }: DataMemoryRouterProps): React.ReactElement {
        return UNSAFE_useRenderDataRouter({
          basename,
          children,
          fallbackElement,
          todo_bikeshed_routes,
          createRouter: (routes) => {
            router = createMemoryRouter({
              basename,
              initialEntries,
              initialIndex,
              routes,
              hydrationData,
            });
            return router;
          },
        });
      }

      let { container } = render(
        <div>
          <LocalDataMemoryRouter
            initialEntries={["/"]}
            hydrationData={{ loaderData: {} }}
          >
            <Route
              path="/"
              element={<Parent />}
              exceptionElement={<p>Don't show this</p>}
            >
              <Route
                path="child"
                element={<Child />}
                exceptionElement={<ErrorBoundary />}
              />
            </Route>
          </LocalDataMemoryRouter>
        </div>
      );

      function Parent() {
        return (
          <>
            <h1>Parent</h1>
            <Outlet />
          </>
        );
      }
      function Child(): React.ReactElement {
        throw new Error("Kaboom!");
      }

      function ErrorBoundary() {
        let error = useRouteException();
        return <p>{error.message}</p>;
      }

      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <div>
            <h1>
              Parent
            </h1>
          </div>
        </div>"
      `);

      router.navigate("/child");
      await waitFor(() => screen.getByText("Kaboom!"));
      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <div>
            <h1>
              Parent
            </h1>
            <p>
              Kaboom!
            </p>
          </div>
        </div>"
      `);

      router.navigate(-1);
      await waitFor(() => {
        expect(queryByText(container, "Kaboom!")).not.toBeInTheDocument();
      });
      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <div>
            <h1>
              Parent
            </h1>
          </div>
        </div>"
      `);
    });

    it("handles back button routing away from a default error boundary", async () => {
      let router: Router;

      // Need this to capture a copy of the router so we can trigger a back
      // navigation from _outside_ the DataMemoryRouter scope to most closely
      // resemble a browser back button
      function LocalDataMemoryRouter({
        basename,
        children,
        initialEntries,
        initialIndex,
        hydrationData,
        fallbackElement,
        todo_bikeshed_routes,
      }: DataMemoryRouterProps): React.ReactElement {
        return UNSAFE_useRenderDataRouter({
          basename,
          children,
          fallbackElement,
          todo_bikeshed_routes,
          createRouter: (routes) => {
            router = createMemoryRouter({
              basename,
              initialEntries,
              initialIndex,
              routes,
              hydrationData,
            });
            return router;
          },
        });
      }

      let { container } = render(
        <div>
          <LocalDataMemoryRouter
            initialEntries={["/"]}
            hydrationData={{ loaderData: {} }}
          >
            <Route path="/" element={<Parent />}>
              <Route path="child" element={<Child />} />
            </Route>
          </LocalDataMemoryRouter>
        </div>
      );

      function Parent() {
        return (
          <>
            <h1>Parent</h1>
            <Outlet />
          </>
        );
      }

      function Child(): React.ReactElement {
        let error = new Error("Kaboom!");
        error.stack = "FAKE STACK TRACE";
        throw error;
      }

      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <div>
            <h1>
              Parent
            </h1>
          </div>
        </div>"
      `);

      router.navigate("/child");
      await waitFor(() => screen.getByText("Kaboom!"));
      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <div>
            <h2>
              Unhandled Thrown Exception!
            </h2>
            <p
              style=\\"font-style: italic;\\"
            >
              Kaboom!
            </p>
            <pre
              style=\\"padding: 0.5rem; background-color: rgba(200, 200, 200, 0.5);\\"
            >
              FAKE STACK TRACE
            </pre>
            <p>
              💿 Hey developer 👋
            </p>
            <p>
              You can provide a way better UX than this when your app throws errors by providing your own 
              <code
                style=\\"padding: 2px 4px; background-color: rgba(200, 200, 200, 0.5);\\"
              >
                exceptionElement
              </code>
               props on 
              <code
                style=\\"padding: 2px 4px; background-color: rgba(200, 200, 200, 0.5);\\"
              >
                &lt;Route&gt;
              </code>
            </p>
          </div>
        </div>"
      `);

      router.navigate(-1);
      await waitFor(() => {
        expect(queryByText(container, "Kaboom!")).not.toBeInTheDocument();
      });
      expect(getHtml(container)).toMatchInlineSnapshot(`
        "<div>
          <div>
            <h1>
              Parent
            </h1>
          </div>
        </div>"
      `);
    });
  });
});

function defer() {
  let resolve: (val?: any) => Promise<void>;
  let reject: (error?: Error) => Promise<void>;
  let promise = new Promise((res, rej) => {
    resolve = async (val: any) => {
      res(val);
      try {
        await promise;
      } catch (e) {}
    };
    reject = async (error?: Error) => {
      rej(error);
      try {
        await promise;
      } catch (e) {}
    };
  });
  return {
    promise,
    //@ts-ignore
    resolve,
    //@ts-ignore
    reject,
  };
}

function getHtml(container: HTMLElement) {
  return prettyDOM(container, null, {
    highlight: false,
    theme: {
      comment: null,
      content: null,
      prop: null,
      tag: null,
      value: null,
    },
  });
}

function MemoryNavigate({
  to,
  formMethod,
  formData,
  children,
}: {
  to: string;
  formMethod?: FormMethod;
  formData?: FormData;
  children: React.ReactNode;
}) {
  let router = React.useContext(UNSAFE_DataRouterContext);

  let onClickHandler = React.useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault();
      router.navigate(to, { formMethod, formData });
    },
    [router, to, formMethod, formData]
  );

  return formData ? (
    <form onClick={onClickHandler} children={children} />
  ) : (
    <a href={to} onClick={onClickHandler} children={children} />
  );
}
