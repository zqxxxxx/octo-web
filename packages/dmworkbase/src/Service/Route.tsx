import React from "react";
import WKApp from "../App";
import { EndpointCategory, EndpointID } from "./Const";
import { EndpointManager } from "./Module";
import { getSid } from "../Utils/search";

export default class RouteManager {
  private handlePopState = () => {
    RouteManager.shared.push(window.location.pathname + window.location.search)
  }

  private handlePageShow = () => {
    RouteManager.shared.push(window.location.pathname + window.location.search)
  }

  private constructor() {
    window.addEventListener('popstate', this.handlePopState);
    window.addEventListener('pageshow', this.handlePageShow);
    this.currentPath = "/"
  }
  public static shared = new RouteManager()

  destroy() {
    window.removeEventListener('popstate', this.handlePopState);
    window.removeEventListener('pageshow', this.handlePageShow);
  }

  currentPath?:string // 当前路由path

  register(path: string, handler: (param: any) => JSX.Element| React.ElementType) {
    EndpointManager.shared.setMethod(`${EndpointID.routePrefix}${path}`, (param) => {
      return handler(param);
    }, { category: EndpointCategory.routes });
  }

  get(path: string, param?: any): JSX.Element| React.ElementType {
    const component = EndpointManager.shared.invoke(`${EndpointID.routePrefix}${path}`, param)
    return component
  }

  push(path: string, param?: any) {
    const requestedURL = new URL(path, window.location.origin)
    const routePath = requestedURL.pathname
    this.currentPath = routePath
    const component = EndpointManager.shared.invoke(`${EndpointID.routePrefix}${routePath}`, param)
    if (component) {
      let sid = getSid()
      // Keep product deep-link parameters during the initial pageshow/popstate
      // dispatch. Consumers such as Loop capture them during route creation and
      // Layout needs the same tuple to persist an external-login return target.
      // Menu navigation still passes a query-free path, so its behaviour is
      // unchanged.
      const url = requestedURL
      url.searchParams.set('sid', sid)
      window.history.pushState({}, "title", url.pathname + url.search)
      WKApp.shared.restContent(component)
    }
  }
}

export class ContextRouteManager {
  setPush!:(view:JSX.Element)=>void
  setReplaceToRoot!:(view:JSX.Element)=>void
  setPop!:()=>void
  setPopToRoot!:()=>void

  push(view:JSX.Element) {
    this.setPush(view)
  }

  replaceToRoot(view: JSX.Element): void {
    this.setReplaceToRoot(view)
  }

  pop() {
    this.setPop()
  }

  popToRoot() {
    this.setPopToRoot()
  }
}
