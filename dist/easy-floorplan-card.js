/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const V = globalThis, pt = V.ShadowRoot && (V.ShadyCSS === void 0 || V.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, ut = Symbol(), Et = /* @__PURE__ */ new WeakMap();
let Bt = class {
  constructor(t, i, r) {
    if (this._$cssResult$ = !0, r !== ut) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = i;
  }
  get styleSheet() {
    let t = this.o;
    const i = this.t;
    if (pt && t === void 0) {
      const r = i !== void 0 && i.length === 1;
      r && (t = Et.get(i)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), r && Et.set(i, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const he = (e) => new Bt(typeof e == "string" ? e : e + "", void 0, ut), Gt = (e, ...t) => {
  const i = e.length === 1 ? e[0] : t.reduce((r, s, n) => r + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s) + e[n + 1], e[0]);
  return new Bt(i, e, ut);
}, pe = (e, t) => {
  if (pt) e.adoptedStyleSheets = t.map((i) => i instanceof CSSStyleSheet ? i : i.styleSheet);
  else for (const i of t) {
    const r = document.createElement("style"), s = V.litNonce;
    s !== void 0 && r.setAttribute("nonce", s), r.textContent = i.cssText, e.appendChild(r);
  }
}, At = pt ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((t) => {
  let i = "";
  for (const r of t.cssRules) i += r.cssText;
  return he(i);
})(e) : e;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: ue, defineProperty: fe, getOwnPropertyDescriptor: ge, getOwnPropertyNames: me, getOwnPropertySymbols: _e, getPrototypeOf: ye } = Object, J = globalThis, Ot = J.trustedTypes, $e = Ot ? Ot.emptyScript : "", xe = J.reactiveElementPolyfillSupport, U = (e, t) => e, B = { toAttribute(e, t) {
  switch (t) {
    case Boolean:
      e = e ? $e : null;
      break;
    case Object:
    case Array:
      e = e == null ? e : JSON.stringify(e);
  }
  return e;
}, fromAttribute(e, t) {
  let i = e;
  switch (t) {
    case Boolean:
      i = e !== null;
      break;
    case Number:
      i = e === null ? null : Number(e);
      break;
    case Object:
    case Array:
      try {
        i = JSON.parse(e);
      } catch {
        i = null;
      }
  }
  return i;
} }, ft = (e, t) => !ue(e, t), Mt = { attribute: !0, type: String, converter: B, reflect: !1, useDefault: !1, hasChanged: ft };
Symbol.metadata ??= Symbol("metadata"), J.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let T = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, i = Mt) {
    if (i.state && (i.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((i = Object.create(i)).wrapped = !0), this.elementProperties.set(t, i), !i.noAccessor) {
      const r = Symbol(), s = this.getPropertyDescriptor(t, r, i);
      s !== void 0 && fe(this.prototype, t, s);
    }
  }
  static getPropertyDescriptor(t, i, r) {
    const { get: s, set: n } = ge(this.prototype, t) ?? { get() {
      return this[i];
    }, set(o) {
      this[i] = o;
    } };
    return { get: s, set(o) {
      const c = s?.call(this);
      n?.call(this, o), this.requestUpdate(t, c, r);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? Mt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(U("elementProperties"))) return;
    const t = ye(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(U("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(U("properties"))) {
      const i = this.properties, r = [...me(i), ..._e(i)];
      for (const s of r) this.createProperty(s, i[s]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const i = litPropertyMetadata.get(t);
      if (i !== void 0) for (const [r, s] of i) this.elementProperties.set(r, s);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [i, r] of this.elementProperties) {
      const s = this._$Eu(i, r);
      s !== void 0 && this._$Eh.set(s, i);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const i = [];
    if (Array.isArray(t)) {
      const r = new Set(t.flat(1 / 0).reverse());
      for (const s of r) i.unshift(At(s));
    } else t !== void 0 && i.push(At(t));
    return i;
  }
  static _$Eu(t, i) {
    const r = i.attribute;
    return r === !1 ? void 0 : typeof r == "string" ? r : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t) => this.enableUpdating = t), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t) => t(this));
  }
  addController(t) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t), this.renderRoot !== void 0 && this.isConnected && t.hostConnected?.();
  }
  removeController(t) {
    this._$EO?.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), i = this.constructor.elementProperties;
    for (const r of i.keys()) this.hasOwnProperty(r) && (t.set(r, this[r]), delete this[r]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return pe(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((t) => t.hostConnected?.());
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t) => t.hostDisconnected?.());
  }
  attributeChangedCallback(t, i, r) {
    this._$AK(t, r);
  }
  _$ET(t, i) {
    const r = this.constructor.elementProperties.get(t), s = this.constructor._$Eu(t, r);
    if (s !== void 0 && r.reflect === !0) {
      const n = (r.converter?.toAttribute !== void 0 ? r.converter : B).toAttribute(i, r.type);
      this._$Em = t, n == null ? this.removeAttribute(s) : this.setAttribute(s, n), this._$Em = null;
    }
  }
  _$AK(t, i) {
    const r = this.constructor, s = r._$Eh.get(t);
    if (s !== void 0 && this._$Em !== s) {
      const n = r.getPropertyOptions(s), o = typeof n.converter == "function" ? { fromAttribute: n.converter } : n.converter?.fromAttribute !== void 0 ? n.converter : B;
      this._$Em = s;
      const c = o.fromAttribute(i, n.type);
      this[s] = c ?? this._$Ej?.get(s) ?? c, this._$Em = null;
    }
  }
  requestUpdate(t, i, r, s = !1, n) {
    if (t !== void 0) {
      const o = this.constructor;
      if (s === !1 && (n = this[t]), r ??= o.getPropertyOptions(t), !((r.hasChanged ?? ft)(n, i) || r.useDefault && r.reflect && n === this._$Ej?.get(t) && !this.hasAttribute(o._$Eu(t, r)))) return;
      this.C(t, i, r);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, i, { useDefault: r, reflect: s, wrapped: n }, o) {
    r && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, o ?? i ?? this[t]), n !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || r || (i = void 0), this._$AL.set(t, i)), s === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (i) {
      Promise.reject(i);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [s, n] of this._$Ep) this[s] = n;
        this._$Ep = void 0;
      }
      const r = this.constructor.elementProperties;
      if (r.size > 0) for (const [s, n] of r) {
        const { wrapped: o } = n, c = this[s];
        o !== !0 || this._$AL.has(s) || c === void 0 || this.C(s, void 0, n, c);
      }
    }
    let t = !1;
    const i = this._$AL;
    try {
      t = this.shouldUpdate(i), t ? (this.willUpdate(i), this._$EO?.forEach((r) => r.hostUpdate?.()), this.update(i)) : this._$EM();
    } catch (r) {
      throw t = !1, this._$EM(), r;
    }
    t && this._$AE(i);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    this._$EO?.forEach((i) => i.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    this._$Eq &&= this._$Eq.forEach((i) => this._$ET(i, this[i])), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
T.elementStyles = [], T.shadowRootOptions = { mode: "open" }, T[U("elementProperties")] = /* @__PURE__ */ new Map(), T[U("finalized")] = /* @__PURE__ */ new Map(), xe?.({ ReactiveElement: T }), (J.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const gt = globalThis, Tt = (e) => e, G = gt.trustedTypes, Ct = G ? G.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, Zt = "$lit$", S = `lit$${Math.random().toFixed(9).slice(2)}$`, Xt = "?" + S, ve = `<${Xt}>`, M = document, j = () => M.createComment(""), W = (e) => e === null || typeof e != "object" && typeof e != "function", mt = Array.isArray, be = (e) => mt(e) || typeof e?.[Symbol.iterator] == "function", it = `[ 	
\f\r]`, L = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, It = /-->/g, Pt = />/g, A = RegExp(`>|${it}(?:([^\\s"'>=/]+)(${it}*=${it}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), Ft = /'/g, zt = /"/g, Yt = /^(?:script|style|textarea|title)$/i, Jt = (e) => (t, ...i) => ({ _$litType$: e, strings: t, values: i }), d = Jt(1), f = Jt(2), F = Symbol.for("lit-noChange"), p = Symbol.for("lit-nothing"), Dt = /* @__PURE__ */ new WeakMap(), O = M.createTreeWalker(M, 129);
function Qt(e, t) {
  if (!mt(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Ct !== void 0 ? Ct.createHTML(t) : t;
}
const we = (e, t) => {
  const i = e.length - 1, r = [];
  let s, n = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = L;
  for (let c = 0; c < i; c++) {
    const l = e[c];
    let a, u, h = -1, g = 0;
    for (; g < l.length && (o.lastIndex = g, u = o.exec(l), u !== null); ) g = o.lastIndex, o === L ? u[1] === "!--" ? o = It : u[1] !== void 0 ? o = Pt : u[2] !== void 0 ? (Yt.test(u[2]) && (s = RegExp("</" + u[2], "g")), o = A) : u[3] !== void 0 && (o = A) : o === A ? u[0] === ">" ? (o = s ?? L, h = -1) : u[1] === void 0 ? h = -2 : (h = o.lastIndex - u[2].length, a = u[1], o = u[3] === void 0 ? A : u[3] === '"' ? zt : Ft) : o === zt || o === Ft ? o = A : o === It || o === Pt ? o = L : (o = A, s = void 0);
    const m = o === A && e[c + 1].startsWith("/>") ? " " : "";
    n += o === L ? l + ve : h >= 0 ? (r.push(a), l.slice(0, h) + Zt + l.slice(h) + S + m) : l + S + (h === -2 ? c : m);
  }
  return [Qt(e, n + (e[i] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
};
class H {
  constructor({ strings: t, _$litType$: i }, r) {
    let s;
    this.parts = [];
    let n = 0, o = 0;
    const c = t.length - 1, l = this.parts, [a, u] = we(t, i);
    if (this.el = H.createElement(a, r), O.currentNode = this.el.content, i === 2 || i === 3) {
      const h = this.el.content.firstChild;
      h.replaceWith(...h.childNodes);
    }
    for (; (s = O.nextNode()) !== null && l.length < c; ) {
      if (s.nodeType === 1) {
        if (s.hasAttributes()) for (const h of s.getAttributeNames()) if (h.endsWith(Zt)) {
          const g = u[o++], m = s.getAttribute(h).split(S), $ = /([.?@])?(.*)/.exec(g);
          l.push({ type: 1, index: n, name: $[2], strings: m, ctor: $[1] === "." ? Se : $[1] === "?" ? Ee : $[1] === "@" ? Ae : Q }), s.removeAttribute(h);
        } else h.startsWith(S) && (l.push({ type: 6, index: n }), s.removeAttribute(h));
        if (Yt.test(s.tagName)) {
          const h = s.textContent.split(S), g = h.length - 1;
          if (g > 0) {
            s.textContent = G ? G.emptyScript : "";
            for (let m = 0; m < g; m++) s.append(h[m], j()), O.nextNode(), l.push({ type: 2, index: ++n });
            s.append(h[g], j());
          }
        }
      } else if (s.nodeType === 8) if (s.data === Xt) l.push({ type: 2, index: n });
      else {
        let h = -1;
        for (; (h = s.data.indexOf(S, h + 1)) !== -1; ) l.push({ type: 7, index: n }), h += S.length - 1;
      }
      n++;
    }
  }
  static createElement(t, i) {
    const r = M.createElement("template");
    return r.innerHTML = t, r;
  }
}
function z(e, t, i = e, r) {
  if (t === F) return t;
  let s = r !== void 0 ? i._$Co?.[r] : i._$Cl;
  const n = W(t) ? void 0 : t._$litDirective$;
  return s?.constructor !== n && (s?._$AO?.(!1), n === void 0 ? s = void 0 : (s = new n(e), s._$AT(e, i, r)), r !== void 0 ? (i._$Co ??= [])[r] = s : i._$Cl = s), s !== void 0 && (t = z(e, s._$AS(e, t.values), s, r)), t;
}
class ke {
  constructor(t, i) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = i;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: i }, parts: r } = this._$AD, s = (t?.creationScope ?? M).importNode(i, !0);
    O.currentNode = s;
    let n = O.nextNode(), o = 0, c = 0, l = r[0];
    for (; l !== void 0; ) {
      if (o === l.index) {
        let a;
        l.type === 2 ? a = new K(n, n.nextSibling, this, t) : l.type === 1 ? a = new l.ctor(n, l.name, l.strings, this, t) : l.type === 6 && (a = new Oe(n, this, t)), this._$AV.push(a), l = r[++c];
      }
      o !== l?.index && (n = O.nextNode(), o++);
    }
    return O.currentNode = M, s;
  }
  p(t) {
    let i = 0;
    for (const r of this._$AV) r !== void 0 && (r.strings !== void 0 ? (r._$AI(t, r, i), i += r.strings.length - 2) : r._$AI(t[i])), i++;
  }
}
class K {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, i, r, s) {
    this.type = 2, this._$AH = p, this._$AN = void 0, this._$AA = t, this._$AB = i, this._$AM = r, this.options = s, this._$Cv = s?.isConnected ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const i = this._$AM;
    return i !== void 0 && t?.nodeType === 11 && (t = i.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, i = this) {
    t = z(this, t, i), W(t) ? t === p || t == null || t === "" ? (this._$AH !== p && this._$AR(), this._$AH = p) : t !== this._$AH && t !== F && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : be(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== p && W(this._$AH) ? this._$AA.nextSibling.data = t : this.T(M.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: i, _$litType$: r } = t, s = typeof r == "number" ? this._$AC(t) : (r.el === void 0 && (r.el = H.createElement(Qt(r.h, r.h[0]), this.options)), r);
    if (this._$AH?._$AD === s) this._$AH.p(i);
    else {
      const n = new ke(s, this), o = n.u(this.options);
      n.p(i), this.T(o), this._$AH = n;
    }
  }
  _$AC(t) {
    let i = Dt.get(t.strings);
    return i === void 0 && Dt.set(t.strings, i = new H(t)), i;
  }
  k(t) {
    mt(this._$AH) || (this._$AH = [], this._$AR());
    const i = this._$AH;
    let r, s = 0;
    for (const n of t) s === i.length ? i.push(r = new K(this.O(j()), this.O(j()), this, this.options)) : r = i[s], r._$AI(n), s++;
    s < i.length && (this._$AR(r && r._$AB.nextSibling, s), i.length = s);
  }
  _$AR(t = this._$AA.nextSibling, i) {
    for (this._$AP?.(!1, !0, i); t !== this._$AB; ) {
      const r = Tt(t).nextSibling;
      Tt(t).remove(), t = r;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class Q {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, i, r, s, n) {
    this.type = 1, this._$AH = p, this._$AN = void 0, this.element = t, this.name = i, this._$AM = s, this.options = n, r.length > 2 || r[0] !== "" || r[1] !== "" ? (this._$AH = Array(r.length - 1).fill(new String()), this.strings = r) : this._$AH = p;
  }
  _$AI(t, i = this, r, s) {
    const n = this.strings;
    let o = !1;
    if (n === void 0) t = z(this, t, i, 0), o = !W(t) || t !== this._$AH && t !== F, o && (this._$AH = t);
    else {
      const c = t;
      let l, a;
      for (t = n[0], l = 0; l < n.length - 1; l++) a = z(this, c[r + l], i, l), a === F && (a = this._$AH[l]), o ||= !W(a) || a !== this._$AH[l], a === p ? t = p : t !== p && (t += (a ?? "") + n[l + 1]), this._$AH[l] = a;
    }
    o && !s && this.j(t);
  }
  j(t) {
    t === p ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Se extends Q {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === p ? void 0 : t;
  }
}
class Ee extends Q {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== p);
  }
}
class Ae extends Q {
  constructor(t, i, r, s, n) {
    super(t, i, r, s, n), this.type = 5;
  }
  _$AI(t, i = this) {
    if ((t = z(this, t, i, 0) ?? p) === F) return;
    const r = this._$AH, s = t === p && r !== p || t.capture !== r.capture || t.once !== r.once || t.passive !== r.passive, n = t !== p && (r === p || s);
    s && this.element.removeEventListener(this.name, this, r), n && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Oe {
  constructor(t, i, r) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = i, this.options = r;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    z(this, t);
  }
}
const Me = gt.litHtmlPolyfillSupport;
Me?.(H, K), (gt.litHtmlVersions ??= []).push("3.3.3");
const Te = (e, t, i) => {
  const r = i?.renderBefore ?? t;
  let s = r._$litPart$;
  if (s === void 0) {
    const n = i?.renderBefore ?? null;
    r._$litPart$ = s = new K(t.insertBefore(j(), n), n, void 0, i ?? {});
  }
  return s._$AI(e), s;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const _t = globalThis;
class P extends T {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const i = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Te(i, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return F;
  }
}
P._$litElement$ = !0, P.finalized = !0, _t.litElementHydrateSupport?.({ LitElement: P });
const Ce = _t.litElementPolyfillSupport;
Ce?.({ LitElement: P });
(_t.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const te = (e) => (t, i) => {
  i !== void 0 ? i.addInitializer(() => {
    customElements.define(e, t);
  }) : customElements.define(e, t);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Ie = { attribute: !0, type: String, converter: B, reflect: !1, hasChanged: ft }, Pe = (e = Ie, t, i) => {
  const { kind: r, metadata: s } = i;
  let n = globalThis.litPropertyMetadata.get(s);
  if (n === void 0 && globalThis.litPropertyMetadata.set(s, n = /* @__PURE__ */ new Map()), r === "setter" && ((e = Object.create(e)).wrapped = !0), n.set(i.name, e), r === "accessor") {
    const { name: o } = i;
    return { set(c) {
      const l = t.get.call(this);
      t.set.call(this, c), this.requestUpdate(o, l, e, !0, c);
    }, init(c) {
      return c !== void 0 && this.C(o, void 0, e, c), c;
    } };
  }
  if (r === "setter") {
    const { name: o } = i;
    return function(c) {
      const l = this[o];
      t.call(this, c), this.requestUpdate(o, l, e, !0, c);
    };
  }
  throw Error("Unsupported decorator location: " + r);
};
function yt(e) {
  return (t, i) => typeof i == "object" ? Pe(e, t, i) : ((r, s, n) => {
    const o = s.hasOwnProperty(n);
    return s.constructor.createProperty(n, r), o ? Object.getOwnPropertyDescriptor(s, n) : void 0;
  })(e, t, i);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function x(e) {
  return yt({ ...e, state: !0, attribute: !1 });
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Fe = (e, t, i) => (i.configurable = !0, i.enumerable = !0, Reflect.decorate && typeof t != "object" && Object.defineProperty(e, t, i), i);
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function $t(e, t) {
  return (i, r, s) => {
    const n = (o) => o.renderRoot?.querySelector(e) ?? null;
    return Fe(i, r, { get() {
      return n(this);
    } });
  };
}
const R = 14, C = 34, I = 16, N = 80, ze = "#9e9e9e", Lt = {
  table: { w: 120, h: 80 },
  roundTable: { w: 100, h: 100 },
  desk: { w: 120, h: 60 },
  chair: { w: 44, h: 44 },
  sofa: { w: 170, h: 72 },
  bed: { w: 150, h: 200 },
  wardrobe: { w: 120, h: 55 },
  rug: { w: 180, h: 120 },
  plant: { w: 44, h: 44 },
  fridge: { w: 60, h: 64 },
  stove: { w: 64, h: 64 },
  sink: { w: 64, h: 48 },
  toilet: { w: 48, h: 68 },
  stairs: { w: 90, h: 170 },
  tv: { w: 110, h: 18 }
}, xt = 1e3, vt = 600, nt = 20, Rt = 50;
function De(e, t) {
  return e ?? t;
}
function Nt(e, t) {
  return t <= 0 ? 100 : Math.round(e / t * 100);
}
function rt(e, t) {
  return Math.max(1, Math.round(t * e / 100));
}
function Ut(e) {
  const t = e?.floors;
  return !t || typeof t != "object" ? [] : Object.values(t).filter((i) => !!i && typeof i.floor_id == "string" && typeof i.name == "string").sort((i, r) => (i.level ?? 0) - (r.level ?? 0) || i.name.localeCompare(r.name));
}
function Le(e) {
  return {
    type: e,
    width: xt,
    height: vt,
    grid: nt,
    walls: [],
    openings: [],
    items: [],
    texts: [],
    furniture: [],
    trackers: []
  };
}
function v(e) {
  return `${e}_${Math.random().toString(36).slice(2, 9)}`;
}
function ot(e, t) {
  if (e === t) return !0;
  if (Array.isArray(e) || Array.isArray(t))
    return !Array.isArray(e) || !Array.isArray(t) || e.length !== t.length ? !1 : e.every((s, n) => ot(s, t[n]));
  if (typeof e != "object" || typeof t != "object" || e === null || t === null) return !1;
  const i = e, r = t;
  for (const s of /* @__PURE__ */ new Set([...Object.keys(i), ...Object.keys(r)]))
    if (!ot(i[s], r[s])) return !1;
  return !0;
}
function Re(e, t = []) {
  return {
    id: v("floor"),
    name: e,
    walls: t,
    openings: [],
    items: [],
    texts: [],
    furniture: [],
    trackers: []
  };
}
function Ne(e) {
  return {
    ...e,
    walls: e.walls ?? [],
    openings: e.openings ?? [],
    items: e.items ?? [],
    texts: e.texts ?? [],
    furniture: e.furniture ?? [],
    trackers: e.trackers ?? []
  };
}
function bt(e) {
  return e.floors && e.floors.length ? e.floors.map(Ne) : [
    {
      id: "floor_main",
      name: "Floor 1",
      walls: e.walls ?? [],
      openings: e.openings ?? [],
      items: e.items ?? [],
      texts: e.texts ?? [],
      furniture: e.furniture ?? [],
      trackers: e.trackers ?? []
    }
  ];
}
function Z(e, t) {
  if (!t) return null;
  const i = e?.[t.entity]?.state;
  if (i == null || i === "unavailable" || i === "unknown") return !1;
  const r = i === "on" || i === "open" || i === "home" || i === "detected";
  return t.invert ? !r : r;
}
function jt(e, t) {
  if (!e || t == null || !Number.isFinite(t)) return null;
  const i = e.max - e.min;
  if (i === 0) return null;
  const r = (t - e.min) / i, s = Math.max(0, Math.min(1, r));
  return e.invert ? 1 - s : s;
}
const D = 8, Wt = "—";
function Ht(e, t) {
  if (!t || !e) return Wt;
  const i = e.states[t];
  return i ? e.formatEntityState(i) : Wt;
}
function ee(e, t, i) {
  if (e.formatEntityState !== t.formatEntityState) return !0;
  for (const r of i)
    if (e.states[r] !== t.states[r]) return !0;
  return !1;
}
function at(e) {
  const t = /* @__PURE__ */ new Set();
  for (const i of bt(e)) {
    for (const r of i.openings) r.entity && t.add(r.entity);
    for (const r of i.items)
      r.entity && t.add(r.entity), r.secondaryEntity && t.add(r.secondaryEntity);
    for (const r of i.trackers)
      for (const s of [r.xSensor, r.ySensor])
        s?.entity && t.add(s.entity), s?.presence?.entity && t.add(s.presence.entity);
  }
  return t;
}
function Ue(e, t) {
  const i = Ht(e, t.entity);
  return t.secondaryEntity ? `${i} · ${Ht(e, t.secondaryEntity)}` : i;
}
function ie(e) {
  switch (e) {
    case "light":
      return "mdi:lightbulb";
    case "switch":
      return "mdi:toggle-switch";
    case "sensor":
      return "mdi:gauge";
    case "binary_sensor":
      return "mdi:radiobox-marked";
    case "climate":
      return "mdi:thermostat";
    case "cover":
      return "mdi:window-shutter";
    default:
      return "mdi:circle";
  }
}
const je = {
  battery: { on: "mdi:battery-alert", off: "mdi:battery" },
  battery_charging: { on: "mdi:battery-charging", off: "mdi:battery" },
  carbon_monoxide: { on: "mdi:smoke-detector-alert", off: "mdi:smoke-detector" },
  cold: { on: "mdi:snowflake", off: "mdi:thermometer" },
  connectivity: { on: "mdi:check-network-outline", off: "mdi:close-network-outline" },
  door: { on: "mdi:door-open", off: "mdi:door-closed" },
  garage_door: { on: "mdi:garage-open", off: "mdi:garage" },
  gas: { on: "mdi:alert-circle", off: "mdi:check-circle" },
  heat: { on: "mdi:fire", off: "mdi:thermometer" },
  light: { on: "mdi:brightness-7", off: "mdi:brightness-5" },
  lock: { on: "mdi:lock-open", off: "mdi:lock" },
  moisture: { on: "mdi:water", off: "mdi:water-off" },
  motion: { on: "mdi:motion-sensor", off: "mdi:motion-sensor-off" },
  occupancy: { on: "mdi:home", off: "mdi:home-outline" },
  opening: { on: "mdi:square-outline", off: "mdi:square" },
  plug: { on: "mdi:power-plug", off: "mdi:power-plug-off" },
  power: { on: "mdi:power-plug", off: "mdi:power-plug-off" },
  presence: { on: "mdi:home", off: "mdi:home-outline" },
  problem: { on: "mdi:alert-circle", off: "mdi:check-circle" },
  running: { on: "mdi:play", off: "mdi:stop" },
  safety: { on: "mdi:alert-circle", off: "mdi:check-circle" },
  smoke: { on: "mdi:smoke-detector-variant-alert", off: "mdi:smoke-detector-variant" },
  sound: { on: "mdi:music-note", off: "mdi:music-note-off" },
  tamper: { on: "mdi:vibrate", off: "mdi:check-circle" },
  vibration: { on: "mdi:vibrate", off: "mdi:crop-portrait" },
  window: { on: "mdi:window-open", off: "mdi:window-closed" }
}, We = {
  temperature: "mdi:thermometer",
  humidity: "mdi:water-percent",
  battery: "mdi:battery",
  power: "mdi:flash",
  energy: "mdi:lightning-bolt",
  illuminance: "mdi:brightness-5",
  pressure: "mdi:gauge",
  carbon_dioxide: "mdi:molecule-co2",
  pm25: "mdi:air-filter",
  signal_strength: "mdi:wifi",
  voltage: "mdi:sine-wave",
  current: "mdi:current-ac"
}, He = {
  garage: { on: "mdi:garage-open", off: "mdi:garage" },
  garage_door: { on: "mdi:garage-open", off: "mdi:garage" },
  door: { on: "mdi:door-open", off: "mdi:door-closed" },
  gate: { on: "mdi:gate-open", off: "mdi:gate" },
  window: { on: "mdi:window-open", off: "mdi:window-closed" },
  blind: { on: "mdi:blinds-open", off: "mdi:blinds" },
  shade: { on: "mdi:roller-shade", off: "mdi:roller-shade-closed" },
  shutter: { on: "mdi:window-shutter-open", off: "mdi:window-shutter" },
  curtain: { on: "mdi:curtains", off: "mdi:curtains-closed" },
  awning: { on: "mdi:awning-outline", off: "mdi:awning-outline" }
};
function Ke(e, t, i) {
  if (!t) return;
  const r = e.split(".")[0];
  if (r === "binary_sensor") {
    const s = je[t];
    return s ? i ? s.on : s.off : void 0;
  }
  if (r === "sensor") return We[t];
  if (r === "cover") {
    const s = He[t];
    return s ? i ? s.on : s.off : void 0;
  }
}
function re(e) {
  return e === "on" || e === "open" || e === "home" || e === "playing";
}
function se(e, t) {
  if (e.icon) return e.icon;
  const i = t?.attributes?.icon;
  return i || (Ke(
    e.entity,
    t?.attributes?.device_class,
    re(t?.state)
  ) ?? ie(e.kind));
}
function qe(e) {
  const t = e.split(".")[0];
  switch (t) {
    case "light":
    case "switch":
    case "sensor":
    case "binary_sensor":
    case "climate":
    case "cover":
      return t;
    default:
      return "generic";
  }
}
function k(e) {
  return e.motion ?? "swing";
}
function wt(e) {
  return e.type === "door" && k(e) === "swing";
}
function Ve(e) {
  return { sx: e.flipH ? -1 : 1, sy: e.flipV ? -1 : 1 };
}
function lt(e) {
  return k(e) === "slide" ? e.sliderStyle ?? "single" : "single";
}
const Be = /* @__PURE__ */ new Set(["window", "blind", "shade", "shutter", "curtain", "awning"]), Ge = /* @__PURE__ */ new Set([
  "garage",
  "garage_door",
  "blind",
  "shade",
  "shutter",
  "curtain"
]);
function Ze(e) {
  return {
    type: Be.has(e ?? "") ? "window" : "door",
    motion: Ge.has(e ?? "") ? "slide" : void 0
  };
}
const Xe = 3;
function Ye(e, t) {
  return e.split(".")[0] === "cover" && t & Xe ? "cover-toggle" : "more-info";
}
function kt(e) {
  return e === "unavailable" || e === "unknown";
}
function Je(e, t) {
  if (!e.entity || t === void 0) return wt(e);
  if (kt(t)) return !1;
  const i = t === "on" || t === "open" || t === "opening" || t === "closing";
  return e.invert ? !i : i;
}
function Qe(e) {
  return e === "opening" || e === "closing";
}
function ne(e, t) {
  if (!e.entity || !t) return wt(e) ? 1 : 0;
  if (kt(t.state)) return 0;
  const i = t.attributes?.current_position;
  if (typeof i == "number" && Number.isFinite(i)) {
    const r = Math.max(0, Math.min(1, i / 100));
    return e.invert ? 1 - r : r;
  }
  return Je(e, t.state) ? 1 : 0;
}
function ti(e, t) {
  return !e.entity || !t || kt(t.state) ? !1 : Qe(t.state) || ne(e, t) > 0;
}
function oe(e, t) {
  const { color: i, open: r = !0, active: s = !1, accent: n = "var(--primary-color, #03a9f4)" } = t, o = e.length / 2, c = D + 4, l = s ? n : i, a = Math.max(0, Math.min(1, t.amount ?? (r ? 1 : 0)));
  let u;
  if (e.type === "window" && k(e) === "swing") {
    const m = Math.PI / 2 * o;
    u = f`
        <!-- jambs -->
        <line x1=${-o} y1=${-c / 2} x2=${-o} y2=${c / 2}
              stroke=${i} stroke-width="2" />
        <line x1=${o} y1=${-c / 2} x2=${o} y2=${c / 2}
              stroke=${i} stroke-width="2" />
        <!-- swing arcs, drawn from the middle outward -->
        <path class="fp-door-arc" d="M 0 0 A ${o} ${o} 0 0 0 ${-o} ${-o}"
              fill="none" stroke-width="1.5" stroke-dasharray=${m}
              style="stroke:${l};stroke-dashoffset:${m * (1 - a)};" />
        <path class="fp-door-arc" d="M 0 0 A ${o} ${o} 0 0 1 ${o} ${-o}"
              fill="none" stroke-width="1.5" stroke-dasharray=${m}
              style="stroke:${l};stroke-dashoffset:${m * (1 - a)};" />
        <!-- left leaf, hinged at left jamb -->
        <g transform="translate(${-o} 0)">
          <g class="fp-door-leaf" style="transform:rotate(${-90 * a}deg);">
            <rect x="0" y="-1.25" width=${o} height="2.5" style="fill:${l};" />
          </g>
        </g>
        <!-- right leaf, hinged at right jamb -->
        <g transform="translate(${o} 0)">
          <g class="fp-leaf-r" style="transform:rotate(${90 * a}deg);">
            <rect x=${-o} y="-1.25" width=${o} height="2.5" style="fill:${l};" />
          </g>
        </g>
      `;
  } else if (k(e) === "slide") {
    const m = e.type === "window" ? 1.5 : 2.5, $ = f`
        <line x1=${-o} y1=${-c / 2} x2=${-o} y2=${c / 2}
              stroke=${i} stroke-width="2" />
        <line x1=${o} y1=${-c / 2} x2=${o} y2=${c / 2}
              stroke=${i} stroke-width="2" />`, w = lt(e);
    if (w === "bypass") {
      const et = -o * a;
      u = f`
        ${$}
        <!-- tracks -->
        <line x1=${-o} y1=${-1.75} x2=${o} y2=${-1.75}
              stroke=${i} stroke-width="0.75" opacity="0.6" />
        <line x1=${-o} y1=${1.75} x2=${o} y2=${1.75}
              stroke=${i} stroke-width="0.75" opacity="0.6" />
        <!-- fixed panel: left half, front track -->
        <rect x=${-o} y=${1.75 - m / 2} width=${o} height=${m} style="fill:${l};" />
        <!-- moving panel: right half, back track -->
        <g class="fp-slide-panel" style="transform:translateX(${et}px);">
          <rect x="0" y=${-1.75 - m / 2} width=${o} height=${m} style="fill:${l};" />
        </g>`;
    } else if (w === "biparting") {
      const b = o * a;
      u = f`
        ${$}
        <!-- track -->
        <line x1=${-o} y1="0" x2=${o} y2="0"
              stroke=${i} stroke-width="0.75" opacity="0.6" />
        <g class="fp-slide-panel" style="transform:translateX(${-b}px);">
          <rect x=${-o} y=${-m / 2} width=${o} height=${m} style="fill:${l};" />
        </g>
        <g class="fp-slide-panel" style="transform:translateX(${b}px);">
          <rect x="0" y=${-m / 2} width=${o} height=${m} style="fill:${l};" />
        </g>`;
    } else {
      const b = e.length * a;
      u = f`
        ${$}
        <!-- track -->
        <line x1=${-o} y1="0" x2=${o} y2="0"
              stroke=${i} stroke-width="0.75" opacity="0.6" />
        <g class="fp-slide-panel" style="transform:translateX(${b}px);">
          <rect x=${-o} y=${-m / 2} width=${e.length} height=${m} style="fill:${l};" />
        </g>`;
    }
  } else {
    const m = -90 * a, $ = Math.PI / 2 * e.length;
    u = f`
        <!-- swing arc: hidden when closed, drawn as it opens -->
        <path class="fp-door-arc"
              d="M ${o} 0 A ${e.length} ${e.length} 0 0 0 ${-o} ${-e.length}"
              fill="none" stroke-width="1.5" stroke-dasharray=${$}
              style="stroke:${l};stroke-dashoffset:${$ * (1 - a)};" />
        <!-- door leaf, hinged at left jamb -->
        <g transform="translate(${-o} 0)">
          <g class="fp-door-leaf" style="transform:rotate(${m}deg);">
            <rect x="0" y="-1.25" width=${e.length} height="2.5" style="fill:${l};" />
          </g>
        </g>
      `;
  }
  const { sx: h, sy: g } = Ve(e);
  return f`<g transform="translate(${e.x} ${e.y}) rotate(${e.angle})">
      <g transform="scale(${h} ${g})">${u}</g>
    </g>`;
}
function ae(e, t, i, r) {
  const s = D + 4;
  return f`
    <defs>
      <mask id=${r} maskUnits="userSpaceOnUse">
        <rect x="0" y="0" width=${t} height=${i} fill="white" />
        ${e.map((n) => {
    const o = n.length / 2;
    return f`<rect x=${n.x - o} y=${n.y - s / 2}
                           width=${n.length} height=${s} fill="black"
                           transform="rotate(${n.angle} ${n.x} ${n.y})" />`;
  })}
      </mask>
    </defs>`;
}
function ct(e) {
  const t = e.color ?? ze, i = e.w, r = e.h, s = i / 2, n = r / 2, c = e.type === "roundTable" || e.type === "plant" ? f`<ellipse cx="0" cy="0" rx=${s} ry=${n}
                   fill=${t} fill-opacity="0.12" stroke=${t} stroke-width="2" />` : e.type === "rug" ? f`<rect x=${-s} y=${-n} width=${i} height=${r} rx=${Math.min(i, r) * 0.12}
                  fill=${t} fill-opacity="0.08" stroke=${t} stroke-width="2"
                  stroke-dasharray="8 5" />` : f`<rect x=${-s} y=${-n} width=${i} height=${r} rx="4"
                  fill=${t} fill-opacity="0.12" stroke=${t} stroke-width="2" />`;
  let l;
  switch (e.type) {
    case "chair":
      l = f`<line x1=${-s} y1=${-n + r * 0.22} x2=${s} y2=${-n + r * 0.22}
                         stroke=${t} stroke-width="2" />`;
      break;
    case "sofa":
      l = f`
        <line x1=${-s} y1=${-n + r * 0.3} x2=${s} y2=${-n + r * 0.3}
              stroke=${t} stroke-width="2" />
        <line x1=${-s + i * 0.12} y1=${-n + r * 0.3} x2=${-s + i * 0.12} y2=${n}
              stroke=${t} stroke-width="2" />
        <line x1=${s - i * 0.12} y1=${-n + r * 0.3} x2=${s - i * 0.12} y2=${n}
              stroke=${t} stroke-width="2" />`;
      break;
    case "bed":
      l = f`
        <line x1=${-s} y1=${-n + r * 0.26} x2=${s} y2=${-n + r * 0.26}
              stroke=${t} stroke-width="2" />
        <rect x=${-s + i * 0.1} y=${-n + r * 0.06} width=${i * 0.34} height=${r * 0.14} rx="3"
              fill="none" stroke=${t} stroke-width="1.5" />
        <rect x=${s - i * 0.44} y=${-n + r * 0.06} width=${i * 0.34} height=${r * 0.14} rx="3"
              fill="none" stroke=${t} stroke-width="1.5" />`;
      break;
    case "fridge":
      l = f`
        <line x1=${-s} y1=${-n + r * 0.4} x2=${s} y2=${-n + r * 0.4}
              stroke=${t} stroke-width="2" />
        <line x1=${s - i * 0.16} y1=${-n + r * 0.12} x2=${s - i * 0.16} y2=${-n + r * 0.3}
              stroke=${t} stroke-width="2" />
        <line x1=${s - i * 0.16} y1=${-n + r * 0.5} x2=${s - i * 0.16} y2=${n - r * 0.16}
              stroke=${t} stroke-width="2" />`;
      break;
    case "stove": {
      const a = Math.min(i, r) * 0.16, u = i * 0.22, h = r * 0.22;
      l = f`
        <circle cx=${-u} cy=${-h} r=${a} fill="none" stroke=${t} stroke-width="2" />
        <circle cx=${u} cy=${-h} r=${a} fill="none" stroke=${t} stroke-width="2" />
        <circle cx=${-u} cy=${h} r=${a} fill="none" stroke=${t} stroke-width="2" />
        <circle cx=${u} cy=${h} r=${a} fill="none" stroke=${t} stroke-width="2" />`;
      break;
    }
    case "sink":
      l = f`
        <rect x=${-s + i * 0.12} y=${-n + r * 0.18} width=${i * 0.76} height=${r * 0.5} rx="4"
              fill="none" stroke=${t} stroke-width="2" />
        <circle cx="0" cy=${-n + r * 0.1} r=${Math.min(i, r) * 0.05}
                fill="none" stroke=${t} stroke-width="2" />`;
      break;
    case "toilet":
      l = f`
        <rect x=${-s + i * 0.1} y=${-n} width=${i * 0.8} height=${r * 0.22} rx="3"
              fill="none" stroke=${t} stroke-width="2" />
        <ellipse cx="0" cy=${n - r * 0.32} rx=${i * 0.34} ry=${r * 0.3}
                 fill="none" stroke=${t} stroke-width="2" />`;
      break;
    case "stairs": {
      const u = [];
      for (let h = 1; h < 7; h++) {
        const g = -n + r / 7 * h;
        u.push(f`<line x1=${-s} y1=${g} x2=${s} y2=${g} stroke=${t} stroke-width="1.5" />`);
      }
      l = f`${u}
        <line x1="0" y1=${n - 6} x2="0" y2=${-n + 6} stroke=${t} stroke-width="1.5" />
        <path d="M ${-i * 0.12} ${-n + r * 0.16} L 0 ${-n + 4} L ${i * 0.12} ${-n + r * 0.16}"
              fill="none" stroke=${t} stroke-width="1.5" />`;
      break;
    }
    case "tv":
      l = f`<line x1=${-i * 0.18} y1=${n} x2=${i * 0.18} y2=${n + r}
                         stroke=${t} stroke-width="2" />`;
      break;
    case "desk":
      l = f`<line x1=${-s} y1=${-n + r * 0.55} x2=${s} y2=${-n + r * 0.55}
                         stroke=${t} stroke-width="1.5" opacity="0.7" />`;
      break;
    case "wardrobe":
      l = f`
        <line x1="0" y1=${-n} x2="0" y2=${n} stroke=${t} stroke-width="2" />
        <line x1=${-i * 0.06} y1=${-r * 0.1} x2=${-i * 0.06} y2=${r * 0.1}
              stroke=${t} stroke-width="2" />
        <line x1=${i * 0.06} y1=${-r * 0.1} x2=${i * 0.06} y2=${r * 0.1}
              stroke=${t} stroke-width="2" />`;
      break;
    case "plant": {
      const a = Math.min(i, r) * 0.18;
      l = f`
        <circle cx="0" cy=${-r * 0.12} r=${a} fill="none" stroke=${t} stroke-width="1.5" />
        <circle cx=${-i * 0.16} cy=${r * 0.08} r=${a} fill="none" stroke=${t} stroke-width="1.5" />
        <circle cx=${i * 0.16} cy=${r * 0.08} r=${a} fill="none" stroke=${t} stroke-width="1.5" />`;
      break;
    }
    case "rug":
      l = f`<rect x=${-s + i * 0.1} y=${-n + r * 0.1} width=${i * 0.8} height=${r * 0.8}
                         rx=${Math.min(i, r) * 0.08} fill="none" stroke=${t}
                         stroke-width="1.5" opacity="0.6" />`;
      break;
    case "table":
    case "roundTable":
    default:
      l = f``;
      break;
  }
  return f`<g transform="translate(${e.x} ${e.y}) rotate(${e.angle ?? 0})">${c}${l}</g>`;
}
function X(e, t, i, r = 3) {
  return d`
    <div
      class="ripple ${e ? "active" : ""}"
      style="width:${i}px;height:${i}px;--fp-ripple-color:${t};"
    >
      <span class="dot"></span>
      ${Array.from(
    { length: r },
    (s, n) => d`<span class="ring" style="animation-delay:${(n * 0.6).toFixed(2)}s;"></span>`
  )}
    </div>
  `;
}
function Y(e, t) {
  if (!t || !e) return null;
  const i = e[t]?.state;
  if (i == null || i === "unavailable" || i === "unknown") return null;
  const r = Number(i);
  return Number.isFinite(r) ? r : null;
}
function le(e, t) {
  const i = e.color ?? "var(--primary-color, #03a9f4)", r = (e.dotSize ?? R) / 2, s = e.x + e.w / 2, n = e.y + e.h / 2, o = e.angle ?? 0, c = jt(e.xSensor, t.xReading), l = jt(e.ySensor, t.yReading), a = c != null, u = l != null, h = t.xPresent === !1 || t.yPresent === !1, g = e.w / 2, m = e.h / 2, $ = t.editing ? f`<rect class="tracker-zone ${h ? "presence-gated" : ""}"
                x=${-g} y=${-m} width=${e.w} height=${e.h}
                fill=${i} fill-opacity="0.08" stroke=${i} stroke-width="1.5"
                stroke-dasharray="6 4" rx="4" pointer-events="none" />` : f``;
  let w;
  if (h)
    w = f``;
  else if (a && u) {
    const b = -g + c * e.w, et = -m + l * e.h, de = `0,${-r} ${r * 0.9},${r * 0.7} ${-r * 0.9},${r * 0.7}`, St = Math.max(r * 3.5, Math.min(e.w, e.h) * 0.45);
    w = f`
      <g class="tracker-marker" style="transform:translate(${b}px, ${et}px);">
        <circle class="tracker-ring" cx="0" cy="0" r="0"
                fill="none" stroke=${i} stroke-width="1.5"
                style="--fp-tracker-ring-max:${St}px;" />
        <circle class="tracker-ring" cx="0" cy="0" r="0"
                fill="none" stroke=${i} stroke-width="1.5"
                style="--fp-tracker-ring-max:${St}px; animation-delay:0.7s;" />
        <polygon class="tracker-dot" points=${de} fill=${i} />
      </g>`;
  } else if (a || u)
    if (a) {
      const b = -g + c * e.w;
      w = f`
        <g class="tracker-line" style="transform:translate(${b}px, 0);">
          <line class="tracker-line-stroke" x1="0" y1=${-m} x2="0" y2=${m}
                stroke=${i} stroke-width="1.5" />
          <line class="tracker-band" x1="0" y1=${-m} x2="0" y2=${m}
                stroke=${i} stroke-width="3" stroke-linecap="round" />
          <line class="tracker-band" x1="0" y1=${-m} x2="0" y2=${m}
                stroke=${i} stroke-width="3" stroke-linecap="round"
                style="animation-delay:0.8s;" />
        </g>`;
    } else {
      const b = -m + l * e.h;
      w = f`
        <g class="tracker-line tracker-line-h" style="transform:translate(0, ${b}px);">
          <line class="tracker-line-stroke" x1=${-g} y1="0" x2=${g} y2="0"
                stroke=${i} stroke-width="1.5" />
          <line class="tracker-band" x1=${-g} y1="0" x2=${g} y2="0"
                stroke=${i} stroke-width="3" stroke-linecap="round" />
          <line class="tracker-band" x1=${-g} y1="0" x2=${g} y2="0"
                stroke=${i} stroke-width="3" stroke-linecap="round"
                style="animation-delay:0.8s;" />
        </g>`;
    }
  else t.editing ? w = f`<circle class="tracker-placeholder" cx="0" cy="0" r=${r}
                          fill=${i} fill-opacity="0.25" />` : w = f``;
  return f`
    <g class="tracker ${t.editing ? "editing" : ""}"
       transform="translate(${s} ${n}) rotate(${o})">
      ${$}${w}
    </g>`;
}
function Kt(e, t, i, r) {
  let s = null, n = r;
  for (const o of i) {
    const c = o.x2 - o.x1, l = o.y2 - o.y1, a = c * c + l * l;
    if (a === 0) continue;
    let u = ((e - o.x1) * c + (t - o.y1) * l) / a;
    u = Math.max(0, Math.min(1, u));
    const h = o.x1 + u * c, g = o.y1 + u * l, m = Math.hypot(e - h, t - g);
    m < n && (n = m, s = { x: h, y: g, angle: Math.atan2(l, c) * 180 / Math.PI });
  }
  return s;
}
var ei = Object.defineProperty, ii = Object.getOwnPropertyDescriptor, tt = (e, t, i, r) => {
  for (var s = r > 1 ? void 0 : r ? ii(t, i) : t, n = e.length - 1, o; n >= 0; n--)
    (o = e[n]) && (s = (r ? o(t, i, s) : o(s)) || s);
  return r && s && ei(t, i, s), s;
};
const ri = /* @__PURE__ */ new Set(["light", "switch", "cover", "fan", "input_boolean"]);
let E = class extends P {
  constructor() {
    super(...arguments), this._wallMaskId = `fp-wall-mask-${E._nextWallMaskId++}`, this._watchedEntities = /* @__PURE__ */ new Set();
  }
  setConfig(e) {
    if (!e || typeof e != "object") throw new Error("Invalid configuration");
    const t = e;
    for (const i of ["walls", "openings", "items", "texts", "furniture", "trackers", "floors"])
      if (t[i] !== void 0 && !Array.isArray(t[i]))
        throw new Error(`Invalid configuration: "${i}" must be a list`);
    for (const i of ["width", "height", "grid"])
      if (t[i] !== void 0 && typeof t[i] != "number")
        throw new Error(`Invalid configuration: "${i}" must be a number`);
    this._config = {
      ...e,
      width: e.width ?? xt,
      height: e.height ?? vt,
      walls: e.walls ?? [],
      openings: e.openings ?? [],
      items: e.items ?? [],
      texts: e.texts ?? [],
      furniture: e.furniture ?? []
    }, this._watchedEntities = at(this._config);
  }
  /**
   * HA pushes a fresh `hass` on every state change anywhere in the instance —
   * for most updates nothing on this plan moved. Skip those renders entirely.
   */
  shouldUpdate(e) {
    if (!(e.size === 1 && e.has("hass"))) return !0;
    const t = e.get("hass");
    return !t || !this.hass ? !0 : ee(t, this.hass, this._watchedEntities);
  }
  getCardSize() {
    return 6;
  }
  static async getConfigElement() {
    return await Promise.resolve().then(() => hi), document.createElement("easy-floorplan-card-editor");
  }
  static getStubConfig() {
    return {};
  }
  /** Sections-view sizing (grid rows ≈ 56px): room for the 5:3 default canvas. */
  static getGridOptions() {
    return { columns: 12, rows: 8, min_columns: 6, min_rows: 4 };
  }
  _isOn(e) {
    return re(this.hass?.states[e.entity]?.state);
  }
  /** How far open an opening should be drawn (0..1), from its entity (or default). */
  _openingAmount(e) {
    const t = e.entity ? this.hass?.states[e.entity] : void 0;
    return ne(e, t);
  }
  /** Whether an opening wears its accent: drawn open, or a cover still in transit. */
  _openingActive(e) {
    const t = e.entity ? this.hass?.states[e.entity] : void 0;
    return ti(e, t);
  }
  _itemIcon(e) {
    return se(e, this.hass?.states[e.entity]);
  }
  _label(e) {
    return e.name ?? this.hass?.states[e.entity]?.attributes?.friendly_name ?? e.entity ?? "";
  }
  _onItemClick(e) {
    if (!this.hass || !e.entity) return;
    const t = e.entity.split(".")[0];
    ri.has(t) ? this.hass.callService("homeassistant", "toggle", { entity_id: e.entity }) : this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: e.entity },
        bubbles: !0,
        composed: !0
      })
    );
  }
  /**
   * Tapping an entity-bound opening: toggle a controllable `cover`, otherwise
   * open the entity's more-info dialog (read-only `binary_sensor`s and
   * position-only covers). See {@link openingClickAction}.
   */
  _onOpeningClick(e) {
    if (!this.hass || !e.entity) return;
    const t = this.hass.states[e.entity]?.attributes?.supported_features ?? 0;
    Ye(e.entity, t) === "cover-toggle" ? this.hass.callService("cover", "toggle", { entity_id: e.entity }) : this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: e.entity },
        bubbles: !0,
        composed: !0
      })
    );
  }
  _renderBadge(e) {
    const t = e.size ?? C;
    return d`
      <div
        class="badge"
        style="width:${t}px;height:${t}px;transform:rotate(${e.angle ?? 0}deg);"
      >
        <ha-icon
          icon=${this._itemIcon(e)}
          style="--mdc-icon-size:${Math.round(t * 0.62)}px;"
        ></ha-icon>
      </div>
    `;
  }
  _renderItem(e, t) {
    const i = this._isOn(e), r = e.showState ?? e.kind === "sensor", s = e.showIcon ?? !0, n = e.display ?? "badge", o = e.rippleColor ?? "var(--primary-color, #03a9f4)", c = e.rippleSize ?? N;
    let l = p;
    return n === "ripple" ? l = X(i, o, c) : n === "iconRipple" ? l = d`<div class="stack">
        ${X(i, o, c)}
        ${s ? d`<div class="stack-icon">${this._renderBadge(e)}</div>` : p}
      </div>` : s && (l = this._renderBadge(e)), d`
      <div
        class="item ${i ? "on" : "off"}"
        style="left:${e.x / t.width * 100}%; top:${e.y / t.height * 100}%;"
        title=${this._label(e)}
        @click=${() => this._onItemClick(e)}
      >
        ${l}
        ${r ? d`<span class="label">${Ue(this.hass, e)}</span>` : p}
      </div>
    `;
  }
  _renderText(e, t) {
    return d`
      <div
        class="text"
        style="left:${e.x / t.width * 100}%; top:${e.y / t.height * 100}%;
               font-size:${e.size ?? I}px;
               color:${e.color ?? "var(--primary-text-color)"};
               transform:translate(-50%,-50%) rotate(${e.angle ?? 0}deg);"
      >
        ${e.text}
      </div>
    `;
  }
  render() {
    if (!this._config) return d`${p}`;
    const e = this._config, t = bt(e), i = t.find((r) => r.id === this._activeFloorId) ?? t.find((r) => r.id === e.defaultFloor) ?? t[0];
    return d`
      <ha-card .header=${e.title ?? p}>
        <div
          class="stage"
          style="aspect-ratio: ${e.width} / ${e.height}; background:${e.background ?? "var(--card-background-color, #fff)"};"
        >
          <svg viewBox="0 0 ${e.width} ${e.height}" preserveAspectRatio="none">
            ${i.image ? f`<image href=${i.image} x="0" y="0" width=${e.width} height=${e.height}
                          preserveAspectRatio="none" opacity=${i.imageOpacity ?? 1} />` : p}
            ${i.furniture.map((r) => ct(r))}
            ${ae(i.openings, e.width, e.height, this._wallMaskId)}
            <g mask=${`url(#${this._wallMaskId})`}>
              ${i.walls.map(
      (r) => f`
                <line x1=${r.x1} y1=${r.y1} x2=${r.x2} y2=${r.y2}
                      class="wall" stroke-width=${D} stroke-linecap="round" />`
    )}
            </g>
            ${i.openings.map((r) => {
      const s = this._openingAmount(r), n = oe(r, {
        color: "var(--primary-text-color)",
        open: s > 0,
        amount: s,
        active: this._openingActive(r),
        accent: r.activeColor ?? "var(--primary-color, #03a9f4)"
      });
      if (!r.entity) return n;
      const o = r.length / 2, c = D + 4;
      return f`<g class="fp-opening" @click=${() => this._onOpeningClick(r)}>
                  ${n}
                  <rect class="fp-opening-hit" x=${r.x - o} y=${r.y - c / 2}
                        width=${r.length} height=${c}
                        transform="rotate(${r.angle} ${r.x} ${r.y})" />
                </g>`;
    })}
            ${(i.trackers ?? []).map(
      (r) => le(r, {
        editing: !1,
        xReading: Y(this.hass?.states, r.xSensor?.entity),
        yReading: Y(this.hass?.states, r.ySensor?.entity),
        xPresent: Z(this.hass?.states, r.xSensor?.presence),
        yPresent: Z(this.hass?.states, r.ySensor?.presence)
      })
    )}
          </svg>
          <div class="items">
            ${i.texts.map((r) => this._renderText(r, e))}
            ${i.items.filter((r) => r.entity).map((r) => this._renderItem(r, e))}
          </div>
          ${t.length > 1 ? this._renderFloorSwitcher(t, i) : p}
        </div>
      </ha-card>
    `;
  }
  _renderFloorSwitcher(e, t) {
    return d`
      <div class="floor-switcher">
        ${e.map(
      (i) => d`
            <button
              class=${i.id === t.id ? "active" : ""}
              title=${i.name}
              @click=${() => {
        this._activeFloorId = i.id;
      }}
            >
              ${i.name}
            </button>
          `
    )}
      </div>
    `;
  }
};
E._nextWallMaskId = 0;
E.styles = Gt`
    ha-card {
      height: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }
    .stage {
      position: relative;
      width: 100%;
      padding: 0;
    }
    .floor-switcher {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      pointer-events: auto;
      z-index: 1;
    }
    .floor-switcher button {
      cursor: pointer;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 12px;
      line-height: 1;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .floor-switcher button.active {
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      border-color: var(--primary-color, #03a9f4);
    }
    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
    .wall {
      stroke: var(--primary-text-color);
    }
    .fp-door-leaf,
    .fp-leaf-r {
      transform-box: fill-box;
      transition: transform 0.5s ease;
    }
    .fp-door-leaf {
      transform-origin: left center;
    }
    .fp-leaf-r {
      transform-origin: right center;
    }
    .fp-door-leaf rect,
    .fp-leaf-r rect {
      transition: fill 0.5s ease;
    }
    .fp-door-arc {
      transition: stroke-dashoffset 0.5s ease, stroke 0.5s ease;
    }
    .fp-opening {
      cursor: pointer;
    }
    .fp-opening-hit {
      fill: transparent;
      pointer-events: all;
    }
    .fp-slide-panel {
      transform-box: fill-box;
      transition: transform 0.5s ease;
    }
    .fp-slide-panel rect {
      transition: fill 0.5s ease;
    }
    .items {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .item {
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .badge {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--card-background-color, #fff);
      border: 1.5px solid var(--divider-color, #ccc);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary-text-color);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    .item.on .badge {
      background: var(--state-light-active-color, var(--state-active-color, #fdd835));
      border-color: var(--state-light-active-color, var(--state-active-color, #fdd835));
      color: var(--text-primary-color, #212121);
    }
    ha-icon {
      --mdc-icon-size: 22px;
    }
    .label {
      font-size: 12px;
      line-height: 1;
      padding: 1px 4px;
      border-radius: 4px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      white-space: nowrap;
    }
    .text {
      position: absolute;
      pointer-events: none;
      white-space: nowrap;
      font-weight: 500;
      line-height: 1;
    }
    .stack {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stack-icon {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ripple {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ripple .ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid var(--fp-ripple-color);
      opacity: 0;
    }
    .ripple.active .ring {
      animation: fp-ripple 1.8s ease-out infinite;
    }
    .ripple .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--fp-ripple-color);
      opacity: 0.4;
    }
    .ripple.active .dot {
      opacity: 0.9;
    }
    @keyframes fp-ripple {
      0% {
        transform: scale(0.15);
        opacity: 0.7;
      }
      100% {
        transform: scale(1);
        opacity: 0;
      }
    }
    /* === Tracker animations (live card). The zone outline is editor-only —
       renderTracker is called with editing:false here, so only the marker /
       line and ripples render. Movement transitions on the group's transform
       so the dot/triangle glides between sensor updates rather than jumping. === */
    .tracker-marker {
      transition: transform 0.4s ease-out;
    }
    .tracker-dot {
      animation: fp-tracker-pulse 1.4s ease-in-out infinite;
      transform-box: fill-box;
      transform-origin: center;
    }
    .tracker-ring {
      animation: fp-tracker-ring 2.2s ease-out infinite;
      opacity: 0;
    }
    .tracker-line {
      transition: transform 0.4s ease-out;
    }
    .tracker-line-stroke {
      opacity: 0.45;
      animation: fp-tracker-pulse 1.6s ease-in-out infinite;
    }
    .tracker-band {
      opacity: 0;
      animation: fp-tracker-band 2.2s ease-out infinite;
    }
    @keyframes fp-tracker-pulse {
      0%,
      100% {
        transform: scale(0.9);
        opacity: 0.7;
      }
      50% {
        transform: scale(1.1);
        opacity: 1;
      }
    }
    @keyframes fp-tracker-ring {
      0% {
        r: 0;
        opacity: 0.7;
      }
      100% {
        r: var(--fp-tracker-ring-max, 60px);
        opacity: 0;
      }
    }
    @keyframes fp-tracker-band {
      0% {
        opacity: 0.5;
        stroke-width: 1.5;
      }
      100% {
        opacity: 0;
        stroke-width: 14;
      }
    }
  `;
tt([
  yt({ attribute: !1 })
], E.prototype, "hass", 2);
tt([
  x()
], E.prototype, "_config", 2);
tt([
  x()
], E.prototype, "_activeFloorId", 2);
E = tt([
  te("easy-floorplan-card")
], E);
const dt = 26;
function ce(e, t, i, r) {
  let s = null, n = r;
  for (const o of e)
    for (const c of [
      { x: o.x1, y: o.y1 },
      { x: o.x2, y: o.y2 }
    ]) {
      const l = Math.hypot(t - c.x, i - c.y);
      l < n && (n = l, s = { x: c.x, y: c.y });
    }
  return s;
}
function si(e, t, i, r, s, n, o, c, l = dt) {
  if (o) return { x: n(r), y: n(s) };
  const a = ce(e, r, s, l);
  if (a) return a;
  const u = r - t, h = s - i, g = Math.tan(c * Math.PI / 180);
  return Math.abs(h) <= Math.abs(u) * g ? { x: n(r), y: i } : Math.abs(u) <= Math.abs(h) * g ? { x: t, y: n(s) } : { x: n(r), y: n(s) };
}
function ni(e, t) {
  const i = Math.min(t.x0, t.x1), r = Math.max(t.x0, t.x1), s = Math.min(t.y0, t.y1), n = Math.max(t.y0, t.y1), o = (l, a) => l >= i && l <= r && a >= s && a <= n, c = [];
  for (const l of e.walls)
    o((l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2) && c.push({ kind: "wall", id: l.id });
  for (const l of e.openings) o(l.x, l.y) && c.push({ kind: "opening", id: l.id });
  for (const l of e.items) o(l.x, l.y) && c.push({ kind: "item", id: l.id });
  for (const l of e.texts) o(l.x, l.y) && c.push({ kind: "text", id: l.id });
  for (const l of e.furniture) o(l.x, l.y) && c.push({ kind: "furniture", id: l.id });
  for (const l of e.trackers ?? [])
    o(l.x + l.w / 2, l.y + l.h / 2) && c.push({ kind: "tracker", id: l.id });
  return c;
}
function oi(e, t, i, r) {
  return {
    walls: e.walls.map((s) => {
      const n = r.get(`wall:${s.id}`);
      return n && n.kind === "wall" ? { ...s, x1: n.x1 + t, y1: n.y1 + i, x2: n.x2 + t, y2: n.y2 + i } : s;
    }),
    openings: e.openings.map((s) => {
      const n = r.get(`opening:${s.id}`);
      return n && n.kind === "pt" ? { ...s, x: n.x + t, y: n.y + i } : s;
    }),
    items: e.items.map((s) => {
      const n = r.get(`item:${s.id}`);
      return n && n.kind === "pt" ? { ...s, x: n.x + t, y: n.y + i } : s;
    }),
    texts: e.texts.map((s) => {
      const n = r.get(`text:${s.id}`);
      return n && n.kind === "pt" ? { ...s, x: n.x + t, y: n.y + i } : s;
    }),
    furniture: e.furniture.map((s) => {
      const n = r.get(`furniture:${s.id}`);
      return n && n.kind === "pt" ? { ...s, x: n.x + t, y: n.y + i } : s;
    }),
    trackers: (e.trackers ?? []).map((s) => {
      const n = r.get(`tracker:${s.id}`);
      return n && n.kind === "pt" ? { ...s, x: n.x + t, y: n.y + i } : s;
    })
  };
}
var ai = Object.defineProperty, li = Object.getOwnPropertyDescriptor, y = (e, t, i, r) => {
  for (var s = r > 1 ? void 0 : r ? li(t, i) : t, n = e.length - 1, o; n >= 0; n--)
    (o = e[n]) && (s = (r ? o(t, i, s) : o(s)) || s);
  return r && s && ai(t, i, s), s;
};
const qt = [
  "table",
  "roundTable",
  "desk",
  "chair",
  "sofa",
  "bed",
  "wardrobe",
  "rug",
  "plant",
  "fridge",
  "stove",
  "sink",
  "toilet",
  "stairs",
  "tv"
], q = {
  table: "table",
  roundTable: "round table",
  desk: "desk",
  chair: "chair",
  sofa: "sofa",
  bed: "bed",
  wardrobe: "wardrobe",
  rug: "rug",
  plant: "plant",
  fridge: "fridge",
  stove: "stove",
  sink: "sink",
  toilet: "toilet",
  stairs: "stairs",
  tv: "tv"
}, st = {
  select: { icon: "mdi:cursor-default", label: "Select" },
  wall: { icon: "mdi:wall", label: "Wall" },
  door: { icon: "mdi:door", label: "Door" },
  window: { icon: "mdi:window-closed-variant", label: "Window" },
  tracker: { icon: "mdi:crosshairs-gps", label: "Tracker" }
}, ci = {
  wall: "mdi:wall",
  opening: "mdi:door",
  item: "mdi:lightbulb-outline",
  text: "mdi:format-text",
  furniture: "mdi:sofa-outline",
  tracker: "mdi:crosshairs-gps"
}, Vt = 35, di = 10;
let _ = class extends P {
  constructor() {
    super(...arguments), this._wallMaskId = `fp-edit-wall-mask-${_._nextWallMaskId++}`, this._watchedEntities = /* @__PURE__ */ new Set(), this._tool = "select", this._selection = [], this._draft = null, this._draftTracker = null, this._freeWalls = !1, this._defaultOpeningLength = 60, this._marquee = null, this._history = [], this._future = [], this._zoom = 1, this._floorMenuOpen = !1, this._addMenuOpen = !1, this._projectOpen = !1, this._fullscreen = !1, this._drag = null, this._gesturePointer = null, this._marqueeAdd = !1, this._clipboard = null, this._onKeyDown = (e) => this._handleKeyDown(e), this._onFocusIn = (e) => {
      this._fullscreen && !e.composedPath().includes(this) && (this._fullscreen = !1);
    }, this._liveEditKey = null, this._gridCache = null;
  }
  connectedCallback() {
    super.connectedCallback(), window.addEventListener("keydown", this._onKeyDown, !0), window.addEventListener("focusin", this._onFocusIn);
  }
  disconnectedCallback() {
    window.removeEventListener("keydown", this._onKeyDown, !0), window.removeEventListener("focusin", this._onFocusIn), super.disconnectedCallback();
  }
  setConfig(e) {
    const t = { ...Le(e.type || "custom:easy-floorplan-card"), ...e }, i = bt(t).map((r) => structuredClone(r));
    this._config = {
      ...t,
      floors: i,
      walls: [],
      openings: [],
      items: [],
      texts: [],
      furniture: [],
      trackers: []
    }, (!this._activeFloorId || !i.some((r) => r.id === this._activeFloorId)) && (this._activeFloorId = t.defaultFloor && i.some((r) => r.id === t.defaultFloor) ? t.defaultFloor : i[0].id), this._lastEmitted && e !== this._lastEmitted && !ot(e, this._lastEmitted) && (this._history = [], this._future = [], this._liveEditKey = null), this._watchedEntities = at(this._config);
  }
  /**
   * HA replaces `hass` on every state change in the instance; the editor's
   * render is expensive (full SVG + panels). Skip ticks that can't change
   * anything we draw. Entity pickers keep the `hass` they last rendered with —
   * acceptable, the registry data they browse changes rarely.
   */
  shouldUpdate(e) {
    if (!(e.size === 1 && e.has("hass"))) return !0;
    const t = e.get("hass");
    if (!t || !this.hass) return !0;
    const i = (r) => r.floors;
    return i(t) !== i(this.hass) ? !0 : ee(t, this.hass, this._watchedEntities);
  }
  // ---- active floor access -----------------------------------------------
  _floor() {
    const e = this._config.floors ?? [];
    return e.find((t) => t.id === this._activeFloorId) ?? e[0];
  }
  /** Discrete change to the active floor's elements (snapshots for undo). */
  _commitFloor(e) {
    this._commit({ ...this._config, floors: this._patchFloors(e) });
  }
  /** Live change to the active floor's elements (no history snapshot — for dragging). */
  _emitFloor(e) {
    this._emit({ ...this._config, floors: this._patchFloors(e) });
  }
  _patchFloors(e) {
    const t = this._config.floors ?? [], i = t.find((r) => r.id === this._activeFloorId) ?? t[0];
    return t.map((r) => i && r.id === i.id ? { ...r, ...e } : r);
  }
  firstUpdated() {
    this._ensurePickers();
    for (const e of ["ha-entity-picker", "ha-icon-picker"])
      customElements.get(e) || customElements.whenDefined(e).then(() => this.requestUpdate());
  }
  /**
   * Promote the expanded editor into the top layer. `position: fixed` alone is
   * not enough: HA's edit dialog puts a `transform` on its surface to offset
   * the safe areas, and any transform makes that surface the containing block
   * for fixed descendants — so a "full-viewport" overlay would fill the narrow
   * dialog instead. A popover escapes it. Collapsing drops the attribute, which
   * hides the popover on its own. Browsers without the API keep the fixed
   * fallback, which is already correct on the mobile dialog (transform: none).
   */
  updated() {
    if (!this._fullscreen) return;
    const e = this._editorEl;
    if (!(!e?.isConnected || typeof e.showPopover != "function") && !e.matches(":popover-open"))
      try {
        e.showPopover();
      } catch {
      }
  }
  /**
   * `ha-entity-picker` / `ha-icon-picker` are only defined after HA loads an
   * entities-card editor. Force that load so both pickers work inside our editor.
   */
  async _ensurePickers() {
    if (customElements.get("ha-entity-picker") && customElements.get("ha-icon-picker")) return;
    const e = await window.loadCardHelpers?.();
    if (!e) return;
    await (await e.createCardElement({ type: "entities", entities: [] })).constructor?.getConfigElement?.(), this.requestUpdate();
  }
  get grid() {
    return this._config.grid ?? nt;
  }
  /**
   * Resolved placement snap step. `snap` is tri-state in the config: unset
   * means "follow the grid" (the default behaviour), `0` is free placement,
   * any other number is a custom step. See {@link resolveSnap}.
   */
  get _resolvedSnap() {
    return De(this._config.snap, this.grid);
  }
  /** Which radio option the panel's "Snap to" control shows as active. */
  get _snapMode() {
    const e = this._config.snap;
    return e == null ? "grid" : e === 0 ? "off" : "custom";
  }
  _setSnapMode(e) {
    if (e === "grid")
      this._patchConfig({ snap: void 0 });
    else if (e === "off")
      this._patchConfig({ snap: 0 });
    else {
      const t = this._config.snap;
      this._patchConfig({
        snap: t && t > 0 ? t : rt(Rt, this.grid)
      });
    }
  }
  /** Update the grid; rescale a custom snap so its percentage of the grid is preserved. */
  _setGrid(e) {
    const t = { grid: e };
    if (this._snapMode === "custom") {
      const i = Nt(this._config.snap, this.grid);
      t.snap = rt(i, e);
    }
    this._patchConfig(t);
  }
  _snap(e) {
    const t = this._resolvedSnap;
    return t > 0 ? Math.round(e / t) * t : e;
  }
  _toVirtual(e, t = !0) {
    const r = this._svg.getScreenCTM();
    if (!r) return { x: 0, y: 0 };
    const s = new DOMPoint(e.clientX, e.clientY).matrixTransform(r.inverse());
    return t ? { x: this._snap(s.x), y: this._snap(s.y) } : { x: s.x, y: s.y };
  }
  /** Nearest existing wall endpoint within ENDPOINT_SNAP, or null. */
  _nearestCorner(e, t) {
    return ce(this._floor().walls, e, t, dt);
  }
  /** Snap a raw point to a nearby existing wall endpoint, else to the snap step. */
  _snapWallPoint(e, t) {
    return this._nearestCorner(e, t) ?? { x: this._snap(e), y: this._snap(t) };
  }
  /** See {@link snapWallEnd}: corners win, then axis gravity, then the snap step. */
  _snapWallEnd(e, t, i, r) {
    return si(
      this._floor().walls,
      e,
      t,
      i,
      r,
      (s) => this._snap(s),
      this._freeWalls,
      di,
      dt
    );
  }
  _emit(e) {
    this._config = e, this._watchedEntities = at(e);
    const t = { ...e };
    for (const i of ["walls", "openings", "items", "texts", "furniture", "trackers"])
      t[i]?.length || delete t[i];
    this._lastEmitted = t, this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config: t }, bubbles: !0, composed: !0 })
    );
  }
  _pushHistory(e = null) {
    this._history = [...this._history, structuredClone(this._config)].slice(-60), this._future = [], this._liveEditKey = e;
  }
  /** Discrete change: snapshot for undo, then emit. */
  _commit(e) {
    this._pushHistory(), this._emit(e);
  }
  _undo() {
    if (this._liveEditKey = null, !this._history.length) return;
    this._future = [structuredClone(this._config), ...this._future];
    const e = this._history[this._history.length - 1];
    this._history = this._history.slice(0, -1), this._selection = [], this._emit(e);
  }
  _redo() {
    if (this._liveEditKey = null, !this._future.length) return;
    this._history = [...this._history, structuredClone(this._config)];
    const e = this._future[0];
    this._future = this._future.slice(1), this._selection = [], this._emit(e);
  }
  // ---- selection ----------------------------------------------------------
  /** The element whose properties show in the panel (the most recent selection). */
  _primary() {
    return this._selection[this._selection.length - 1] ?? null;
  }
  _selectOne(e) {
    this._selection = [e], this._liveEditKey = null;
  }
  _toggleSel(e) {
    this._selection = this._isSel(e.kind, e.id) ? this._selection.filter((t) => !(t.kind === e.kind && t.id === e.id)) : [...this._selection, e], this._liveEditKey = null;
  }
  _clearSel() {
    this._selection = [], this._liveEditKey = null;
  }
  /** Pointer-driven selection: modifier toggles; plain click selects unless already in the set. */
  _selectForPointer(e, t) {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      this._toggleSel(t);
      return;
    }
    this._isSel(t.kind, t.id) || this._selectOne(t);
  }
  _idsOfKind(e) {
    return new Set(this._selection.filter((t) => t.kind === e).map((t) => t.id));
  }
  _mergeSel(e, t) {
    const i = [...e];
    for (const r of t) i.some((s) => s.kind === r.kind && s.id === r.id) || i.push(r);
    return i;
  }
  // ---- keyboard nudging ---------------------------------------------------
  _handleKeyDown(e) {
    const t = this.checkVisibility;
    if (t && !t.call(this)) return;
    const i = e.composedPath();
    if (!i.includes(this)) {
      this._fullscreen && e.key === "Escape" && (e.preventDefault(), e.stopPropagation(), this._fullscreen = !1);
      return;
    }
    if (i.some((u) => {
      const h = u, g = h.tagName?.toLowerCase();
      return g === "input" || g === "textarea" || g === "select" || g === "ha-entity-picker" || g === "ha-icon-picker" || h.isContentEditable === !0;
    })) {
      e.key === "Escape" && this._fullscreen && (e.preventDefault(), e.stopPropagation(), this._canvasWrap?.focus());
      return;
    }
    const s = e.ctrlKey || e.metaKey, n = e.key.toLowerCase();
    if (!!(this._drag || this._draft || this._draftTracker || this._marquee) && e.key !== "Escape" && !(s && n === "c")) return;
    if (s && n === "c") {
      this._selection.length && (e.preventDefault(), this._copy());
      return;
    }
    if (s && n === "v") {
      this._clipboard && (e.preventDefault(), this._paste());
      return;
    }
    if (s && n === "d") {
      this._selection.length && (e.preventDefault(), this._duplicate());
      return;
    }
    if (s && n === "z") {
      e.preventDefault(), e.shiftKey ? this._redo() : this._undo();
      return;
    }
    if (s && n === "y") {
      e.preventDefault(), this._redo();
      return;
    }
    if (e.key === "Escape") {
      if (this._floorMenuOpen || this._addMenuOpen) {
        e.preventDefault(), e.stopPropagation(), this._floorMenuOpen = !1, this._addMenuOpen = !1;
        return;
      }
      this._draft || this._draftTracker || this._marquee || this._drag ? (e.preventDefault(), e.stopPropagation(), this._cancelGesture()) : this._selection.length ? (e.preventDefault(), e.stopPropagation(), this._clearSel()) : this._fullscreen && (e.preventDefault(), e.stopPropagation(), this._fullscreen = !1);
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && this._selection.length) {
      e.preventDefault(), this._deleteSelected();
      return;
    }
    if (!this._selection.length) return;
    const l = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    }[e.key];
    if (!l) return;
    e.preventDefault();
    const a = e.shiftKey ? this.grid : this._resolvedSnap || 1;
    this._nudge(l[0] * a, l[1] * a);
  }
  _nudge(e, t) {
    if (!this._selection.length) return;
    const i = this._floor(), r = this._idsOfKind("wall"), s = this._idsOfKind("opening"), n = this._idsOfKind("item"), o = this._idsOfKind("text"), c = this._idsOfKind("furniture"), l = this._idsOfKind("tracker");
    this._commitFloor({
      walls: i.walls.map(
        (a) => r.has(a.id) ? { ...a, x1: a.x1 + e, y1: a.y1 + t, x2: a.x2 + e, y2: a.y2 + t } : a
      ),
      openings: i.openings.map((a) => s.has(a.id) ? { ...a, x: a.x + e, y: a.y + t } : a),
      items: i.items.map((a) => n.has(a.id) ? { ...a, x: a.x + e, y: a.y + t } : a),
      texts: i.texts.map((a) => o.has(a.id) ? { ...a, x: a.x + e, y: a.y + t } : a),
      furniture: i.furniture.map(
        (a) => c.has(a.id) ? { ...a, x: a.x + e, y: a.y + t } : a
      ),
      trackers: (i.trackers ?? []).map(
        (a) => l.has(a.id) ? { ...a, x: a.x + e, y: a.y + t } : a
      )
    });
  }
  // ---- canvas (SVG) pointer handling: drawing walls/openings -------------
  /**
   * Best-effort pointer capture. `setPointerCapture` throws NotFoundError when
   * the pointer id isn't active (synthetic events, or HA's dialog re-targeting
   * the pointer), which would abort the rest of the calling handler — we hit
   * exactly that with the tracker tool's drag-to-draw. Capture is an
   * enhancement (smooth dragging past the canvas edge), never a requirement,
   * so failures are safe to swallow.
   */
  _capturePointer(e, t = e.target) {
    try {
      t?.setPointerCapture?.(e.pointerId);
    } catch {
    }
  }
  /** Best-effort release; pointerup releases capture implicitly anyway. */
  _releasePointer(e, t = e.target) {
    try {
      t?.releasePointerCapture?.(e.pointerId);
    } catch {
    }
  }
  _onCanvasDown(e) {
    if (e.button !== 0 || this._gesturePointer !== null) return;
    this._canvasWrap?.focus();
    const t = this._toVirtual(e, !1);
    if (this._tool === "wall") {
      const i = this._freeWalls ? { x: this._snap(t.x), y: this._snap(t.y) } : this._snapWallPoint(t.x, t.y);
      this._draft = { x1: i.x, y1: i.y, x2: i.x, y2: i.y }, this._gesturePointer = e.pointerId, this._capturePointer(e);
      return;
    }
    if (this._tool === "door" || this._tool === "window") {
      this._addOpening(this._tool, this._snap(t.x), this._snap(t.y));
      return;
    }
    if (this._tool === "tracker") {
      const i = this._snap(t.x), r = this._snap(t.y);
      this._draftTracker = { x0: i, y0: r, x1: i, y1: r }, this._gesturePointer = e.pointerId, this._capturePointer(e);
      return;
    }
    this._marqueeAdd = e.shiftKey || e.ctrlKey || e.metaKey, this._marquee = { x0: t.x, y0: t.y, x1: t.x, y1: t.y }, this._gesturePointer = e.pointerId, this._capturePointer(e);
  }
  /**
   * Abort any in-progress gesture. A moved drag is rolled back to the exact
   * pre-drag config (restoring wall-snap angle changes too) and its own
   * history snapshot — matched by identity, in case something else pushed in
   * between — is dropped, so a canceled drag leaves no trace in undo.
   */
  _cancelGesture() {
    this._gesturePointer = null, this._draft = null, this._draftTracker = null, this._marquee = null;
    const e = this._drag;
    this._drag = null, e?.moved && e.snapshot && (this._history = this._history.filter((t) => t !== e.snapshot), this._emit(e.snapshot));
  }
  _onPointerCancel(e) {
    this._gesturePointer !== null && e.pointerId !== this._gesturePointer || this._cancelGesture();
  }
  /** True when this event belongs to a pointer other than the gesture's. */
  _foreignPointer(e) {
    return this._gesturePointer !== null && e.pointerId !== this._gesturePointer;
  }
  _onCanvasMove(e) {
    if (!this._foreignPointer(e)) {
      if (e.buttons === 0 && (this._drag || this._draft || this._draftTracker || this._marquee)) {
        this._cancelGesture();
        return;
      }
      if (this._tool === "wall" && this._draft) {
        const t = this._toVirtual(e, !1), i = this._snapWallEnd(this._draft.x1, this._draft.y1, t.x, t.y);
        this._draft = { ...this._draft, x2: i.x, y2: i.y };
        return;
      }
      if (this._tool === "tracker" && this._draftTracker) {
        const t = this._toVirtual(e, !1);
        this._draftTracker = {
          ...this._draftTracker,
          x1: this._snap(t.x),
          y1: this._snap(t.y)
        };
        return;
      }
      if (this._marquee) {
        const t = this._toVirtual(e, !1);
        this._marquee = { ...this._marquee, x1: t.x, y1: t.y };
        return;
      }
      this._drag && this._applyDrag(e);
    }
  }
  _onCanvasUp(e) {
    if (!this._foreignPointer(e)) {
      if (this._gesturePointer = null, this._tool === "wall" && this._draft) {
        const t = this._draft;
        if (this._draft = null, t.x1 !== t.x2 || t.y1 !== t.y2) {
          const i = { id: v("wall"), ...t };
          this._commitFloor({ walls: [...this._floor().walls, i] }), this._selection = [{ kind: "wall", id: i.id }];
        }
        return;
      }
      if (this._tool === "tracker" && this._draftTracker) {
        const t = this._draftTracker;
        this._draftTracker = null, this._releasePointer(e);
        const i = Math.min(t.x0, t.x1), r = Math.min(t.y0, t.y1), s = Math.abs(t.x1 - t.x0), n = Math.abs(t.y1 - t.y0);
        s >= this.grid / 2 && n >= this.grid / 2 && this._addTracker(i, r, s, n);
        return;
      }
      if (this._marquee) {
        const t = this._marquee;
        if (this._marquee = null, this._releasePointer(e), !(Math.hypot(t.x1 - t.x0, t.y1 - t.y0) > 4)) {
          this._marqueeAdd || this._clearSel();
          return;
        }
        const r = this._elementsInRect(t);
        this._selection = this._marqueeAdd ? this._mergeSel(this._selection, r) : r, this._liveEditKey = null;
        return;
      }
      this._drag && (this._drag = null, this._releasePointer(e));
    }
  }
  /** All active-floor elements whose center lies inside the marquee rect. */
  _elementsInRect(e) {
    return ni(this._floor(), e);
  }
  // ---- dragging existing elements ----------------------------------------
  _startDrag(e, t, i) {
    this._tool === "select" && (e.stopPropagation(), this._gesturePointer === null && (this._canvasWrap?.focus(), i ? this._selectOne(t) : this._selectForPointer(e, t), this._drag = {
      primary: t,
      start: this._toVirtual(e, !1),
      orig: this._snapshotSelection(),
      endpoint: i
    }, this._gesturePointer = e.pointerId, this._capturePointer(e)));
  }
  /** Capture the start positions of every selected element on the active floor. */
  _snapshotSelection() {
    const e = this._floor(), t = /* @__PURE__ */ new Map();
    for (const i of this._selection)
      if (i.kind === "wall") {
        const r = e.walls.find((s) => s.id === i.id);
        r && t.set(`wall:${r.id}`, { kind: "wall", x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2 });
      } else if (i.kind === "opening") {
        const r = e.openings.find((s) => s.id === i.id);
        r && t.set(`opening:${r.id}`, { kind: "pt", x: r.x, y: r.y });
      } else if (i.kind === "item") {
        const r = e.items.find((s) => s.id === i.id);
        r && t.set(`item:${r.id}`, { kind: "pt", x: r.x, y: r.y });
      } else if (i.kind === "text") {
        const r = e.texts.find((s) => s.id === i.id);
        r && t.set(`text:${r.id}`, { kind: "pt", x: r.x, y: r.y });
      } else if (i.kind === "furniture") {
        const r = e.furniture.find((s) => s.id === i.id);
        r && t.set(`furniture:${r.id}`, { kind: "pt", x: r.x, y: r.y });
      } else {
        const r = (e.trackers ?? []).find((s) => s.id === i.id);
        r && t.set(`tracker:${r.id}`, { kind: "pt", x: r.x, y: r.y });
      }
    return t;
  }
  _applyDrag(e) {
    const t = this._drag, i = this._toVirtual(e, !1);
    if (!t.moved) {
      if (Math.hypot(i.x - t.start.x, i.y - t.start.y) <= 4) return;
      t.moved = !0, this._pushHistory(), t.snapshot = this._history[this._history.length - 1];
    }
    const r = this._floor();
    if (t.endpoint) {
      const a = this._snapWallPoint(i.x, i.y), u = r.walls.map((h) => h.id !== t.primary.id ? h : t.endpoint === 1 ? { ...h, x1: a.x, y1: a.y } : { ...h, x2: a.x, y2: a.y });
      this._emitFloor({ walls: u });
      return;
    }
    if (this._selection.length === 1 && t.primary.kind === "opening") {
      const a = t.orig.get(`opening:${t.primary.id}`);
      if (a && a.kind === "pt") {
        const u = a.x + (i.x - t.start.x), h = a.y + (i.y - t.start.y), g = Kt(u, h, r.walls, Vt), m = r.openings.map(
          ($) => $.id === t.primary.id ? g ? { ...$, x: g.x, y: g.y, angle: g.angle } : { ...$, x: this._snap(u), y: this._snap(h) } : $
        );
        this._emitFloor({ openings: m });
        return;
      }
    }
    const s = t.orig.get(`${t.primary.kind}:${t.primary.id}`);
    if (!s) return;
    const n = s.kind === "wall" ? s.x1 : s.x, o = s.kind === "wall" ? s.y1 : s.y, c = this._snap(n + (i.x - t.start.x)) - n, l = this._snap(o + (i.y - t.start.y)) - o;
    this._emitFloor(this._applyDelta(c, l, t.orig));
  }
  /** Translate every snapshotted element by (dx, dy). */
  _applyDelta(e, t, i) {
    return oi(this._floor(), e, t, i);
  }
  // ---- overlay drag for items & texts (HTML, not SVG) --------------------
  _onOverlayDown(e, t) {
    this._tool === "select" && (e.stopPropagation(), e.preventDefault(), this._gesturePointer === null && (this._canvasWrap?.focus(), this._selectForPointer(e, t), this._drag = {
      primary: t,
      start: this._toVirtual(e, !1),
      orig: this._snapshotSelection()
    }, this._gesturePointer = e.pointerId, this._capturePointer(e, e.currentTarget)));
  }
  _onOverlayMove(e) {
    if (!this._foreignPointer(e)) {
      if (e.buttons === 0 && this._drag) {
        this._cancelGesture();
        return;
      }
      this._drag && this._applyDrag(e);
    }
  }
  _onOverlayUp(e) {
    this._foreignPointer(e) || (this._gesturePointer = null, this._drag && (this._drag = null, this._releasePointer(e, e.currentTarget)));
  }
  // ---- element creation / mutation ---------------------------------------
  _addOpening(e, t, i) {
    const r = this._floor(), s = Kt(t, i, r.walls, Vt), n = {
      id: v(e),
      type: e,
      x: s?.x ?? t,
      y: s?.y ?? i,
      // User-editable from the door/window context bar so opening size can be
      // set BEFORE placing (the previous hardcoded 60 forced place-then-resize).
      length: this._defaultOpeningLength,
      angle: s?.angle ?? 0
    };
    this._commitFloor({ openings: [...r.openings, n] }), this._selection = [{ kind: "opening", id: n.id }], this._tool = "select";
  }
  _addItem(e) {
    const t = {
      id: v("item"),
      entity: "",
      x: this._snap(this._config.width / 2),
      y: this._snap(this._config.height / 2),
      kind: e,
      showState: e === "sensor",
      showIcon: !0,
      size: C
    };
    this._commitFloor({ items: [...this._floor().items, t] }), this._selection = [{ kind: "item", id: t.id }], this._tool = "select";
  }
  _addFurniture(e) {
    const t = Lt[e], i = {
      id: v("furn"),
      type: e,
      x: this._snap(this._config.width / 2),
      y: this._snap(this._config.height / 2),
      w: t.w,
      h: t.h,
      angle: 0
    };
    this._commitFloor({ furniture: [...this._floor().furniture, i] }), this._selection = [{ kind: "furniture", id: i.id }], this._tool = "select";
  }
  /**
   * Drop a new Tracker on the active floor sized to the user's drag and
   * select it so the per-element editor (entity pickers + sensor ranges) is
   * immediately reachable. Tool switches back to Select so the user can
   * configure / move the new tracker without re-dragging.
   */
  _addTracker(e, t, i, r) {
    const s = {
      id: v("tracker"),
      x: e,
      y: t,
      w: i,
      h: r,
      angle: 0,
      dotSize: R
    };
    this._commitFloor({ trackers: [...this._floor().trackers ?? [], s] }), this._selection = [{ kind: "tracker", id: s.id }], this._tool = "select";
  }
  _addText() {
    const e = {
      id: v("text"),
      x: this._snap(this._config.width / 2),
      y: this._snap(this._config.height / 2),
      text: "Label",
      size: I
    };
    this._commitFloor({ texts: [...this._floor().texts, e] }), this._selection = [{ kind: "text", id: e.id }], this._tool = "select";
  }
  _deleteSelected() {
    if (!this._selection.length) return;
    const e = this._floor(), t = this._idsOfKind("wall"), i = this._idsOfKind("opening"), r = this._idsOfKind("item"), s = this._idsOfKind("text"), n = this._idsOfKind("furniture"), o = this._idsOfKind("tracker");
    this._commitFloor({
      walls: e.walls.filter((c) => !t.has(c.id)),
      openings: e.openings.filter((c) => !i.has(c.id)),
      items: e.items.filter((c) => !r.has(c.id)),
      texts: e.texts.filter((c) => !s.has(c.id)),
      furniture: e.furniture.filter((c) => !n.has(c.id)),
      trackers: (e.trackers ?? []).filter((c) => !o.has(c.id))
    }), this._clearSel();
  }
  // ---- clipboard (copy / paste / duplicate) ------------------------------
  _copy() {
    if (!this._selection.length) return;
    const e = this._floor(), t = this._idsOfKind("wall"), i = this._idsOfKind("opening"), r = this._idsOfKind("item"), s = this._idsOfKind("text"), n = this._idsOfKind("furniture"), o = this._idsOfKind("tracker");
    this._clipboard = structuredClone({
      walls: e.walls.filter((c) => t.has(c.id)),
      openings: e.openings.filter((c) => i.has(c.id)),
      items: e.items.filter((c) => r.has(c.id)),
      texts: e.texts.filter((c) => s.has(c.id)),
      furniture: e.furniture.filter((c) => n.has(c.id)),
      trackers: (e.trackers ?? []).filter((c) => o.has(c.id))
    });
  }
  /** Paste the clipboard onto the active floor, offset by one snap step, with fresh ids. */
  _paste() {
    if (!this._clipboard) return;
    const e = structuredClone(this._clipboard), t = this._resolvedSnap || this.grid, i = this._floor(), r = e.walls.map((a) => ({
      ...a,
      id: v("wall"),
      x1: a.x1 + t,
      y1: a.y1 + t,
      x2: a.x2 + t,
      y2: a.y2 + t
    })), s = e.openings.map((a) => ({
      ...a,
      id: v(a.type),
      x: a.x + t,
      y: a.y + t
    })), n = e.items.map((a) => ({
      ...a,
      id: v("item"),
      x: a.x + t,
      y: a.y + t
    })), o = e.texts.map((a) => ({
      ...a,
      id: v("text"),
      x: a.x + t,
      y: a.y + t
    })), c = e.furniture.map((a) => ({
      ...a,
      id: v("furn"),
      x: a.x + t,
      y: a.y + t
    })), l = (e.trackers ?? []).map((a) => ({
      ...a,
      id: v("tracker"),
      x: a.x + t,
      y: a.y + t
    }));
    this._commitFloor({
      walls: [...i.walls, ...r],
      openings: [...i.openings, ...s],
      items: [...i.items, ...n],
      texts: [...i.texts, ...o],
      furniture: [...i.furniture, ...c],
      trackers: [...i.trackers ?? [], ...l]
    }), this._selection = [
      ...r.map((a) => ({ kind: "wall", id: a.id })),
      ...s.map((a) => ({ kind: "opening", id: a.id })),
      ...n.map((a) => ({ kind: "item", id: a.id })),
      ...o.map((a) => ({ kind: "text", id: a.id })),
      ...c.map((a) => ({ kind: "furniture", id: a.id })),
      ...l.map((a) => ({ kind: "tracker", id: a.id }))
    ], this._tool = "select";
  }
  _duplicate() {
    this._copy(), this._paste();
  }
  // ---- floors -------------------------------------------------------------
  /** Add a floor that reuses the current floor's walls (fresh ids) and nothing else. */
  _addFloor() {
    const e = this._floor().walls.map((s) => ({ ...s, id: v("wall") })), t = (this._config.floors?.length ?? 1) + 1, i = Re(`Floor ${t}`, e), r = [...this._config.floors ?? [], i];
    this._activeFloorId = i.id, this._clearSel(), this._commit({ ...this._config, floors: r });
  }
  _switchFloor(e) {
    e !== this._activeFloorId && (this._activeFloorId = e, this._clearSel());
  }
  _renameFloor(e, t) {
    this._commit({
      ...this._config,
      floors: (this._config.floors ?? []).map((i) => i.id === e ? { ...i, name: t } : i)
    });
  }
  /**
   * Link the active floor to a Home Assistant floor (issue #24). Linking also
   * names the floor after the HA floor — the point of the association — while
   * a later manual rename sticks (we never re-sync silently). Unlinking keeps
   * the current name.
   */
  _linkHaFloor(e) {
    const t = Ut(this.hass).find((i) => i.floor_id === e);
    this._commit({
      ...this._config,
      floors: (this._config.floors ?? []).map(
        (i) => i.id === this._activeFloorId ? { ...i, haFloor: t?.floor_id, ...t ? { name: t.name } : {} } : i
      )
    });
  }
  /** HA-floor link row for the floor gear popover; hidden when HA exposes no floors. */
  _renderHaFloorRow(e) {
    const t = Ut(this.hass);
    return t.length ? d`
      <div class="pop-row">
        <label>HA floor</label>
        <select
          .value=${e?.haFloor ?? ""}
          @change=${(i) => this._linkHaFloor(i.target.value)}
        >
          <option value="" ?selected=${!e?.haFloor}>(not linked)</option>
          ${t.map(
      (i) => d`<option value=${i.floor_id} ?selected=${e?.haFloor === i.floor_id}>
                ${i.name}
              </option>`
    )}
        </select>
      </div>
    ` : d`${p}`;
  }
  _deleteFloor() {
    const e = this._config.floors ?? [];
    if (e.length <= 1) return;
    const t = e.findIndex((r) => r.id === this._activeFloorId), i = e.filter((r) => r.id !== this._activeFloorId);
    this._commit({ ...this._config, floors: i }), this._activeFloorId = i[Math.max(0, t - 1)].id, this._clearSel();
  }
  _updateWall(e, t) {
    this._commitFloor({
      walls: this._floor().walls.map((i) => i.id === e ? { ...i, ...t } : i)
    });
  }
  _updateOpening(e, t) {
    this._commitFloor({
      openings: this._floor().openings.map((i) => i.id === e ? { ...i, ...t } : i)
    });
  }
  _updateItem(e, t) {
    this._commitFloor({
      items: this._floor().items.map((i) => i.id === e ? { ...i, ...t } : i)
    });
  }
  _updateText(e, t) {
    this._commitFloor({
      texts: this._floor().texts.map((i) => i.id === e ? { ...i, ...t } : i)
    });
  }
  _updateFurniture(e, t) {
    this._commitFloor({
      furniture: this._floor().furniture.map((i) => i.id === e ? { ...i, ...t } : i)
    });
  }
  _updateTracker(e, t) {
    this._commitFloor({
      trackers: (this._floor().trackers ?? []).map(
        (i) => i.id === e ? { ...i, ...t } : i
      )
    });
  }
  /** Patch a single field on one of a tracker's sensor sub-objects (X / Y axis). */
  _updateTrackerSensor(e, t, i) {
    const r = (this._floor().trackers ?? []).find((n) => n.id === e);
    if (!r) return;
    if (i === null) {
      this._updateTracker(e, { [t]: void 0 });
      return;
    }
    const s = r[t] ?? { entity: "", min: 0, max: 5 };
    this._updateTracker(e, { [t]: { ...s, ...i } });
  }
  _patchConfig(e) {
    this._commit({ ...this._config, ...e });
  }
  /**
   * Live variants for continuous controls (sliders, color pickers, typing):
   * one undo snapshot per edit burst — keyed by element and fields — then
   * plain emits, instead of a full-config clone per input event.
   */
  _beginLive(e, t, i) {
    const r = `${e}:${t}:${Object.keys(i).sort().join(",")}`;
    this._liveEditKey !== r && this._pushHistory(r);
  }
  _updateOpeningLive(e, t) {
    this._beginLive("opening", e, t), this._emitFloor({
      openings: this._floor().openings.map((i) => i.id === e ? { ...i, ...t } : i)
    });
  }
  _updateItemLive(e, t) {
    this._beginLive("item", e, t), this._emitFloor({
      items: this._floor().items.map((i) => i.id === e ? { ...i, ...t } : i)
    });
  }
  _updateTextLive(e, t) {
    this._beginLive("text", e, t), this._emitFloor({
      texts: this._floor().texts.map((i) => i.id === e ? { ...i, ...t } : i)
    });
  }
  _updateFurnitureLive(e, t) {
    this._beginLive("furniture", e, t), this._emitFloor({
      furniture: this._floor().furniture.map((i) => i.id === e ? { ...i, ...t } : i)
    });
  }
  _updateTrackerLive(e, t) {
    this._beginLive("tracker", e, t), this._emitFloor({
      trackers: (this._floor().trackers ?? []).map((i) => i.id === e ? { ...i, ...t } : i)
    });
  }
  _patchConfigLive(e) {
    this._beginLive("config", "", e), this._emit({ ...this._config, ...e });
  }
  _patchFloorLive(e) {
    this._beginLive("floor", this._activeFloorId, e), this._emitFloor(e);
  }
  // ---- rendering ----------------------------------------------------------
  // ---- zoom ----------------------------------------------------------------
  _setZoom(e) {
    this._zoom = Math.min(3, Math.max(0.5, Math.round(e * 100) / 100));
  }
  /** Ctrl/Cmd + wheel zooms the canvas (also catches trackpad pinch); plain wheel scrolls. */
  _onCanvasWheel(e) {
    !e.ctrlKey && !e.metaKey || (e.preventDefault(), this._setZoom(this._zoom - Math.sign(e.deltaY) * 0.1));
  }
  /** Reset to 100% (where the stage fits the wrap width) and scroll home. */
  _fitView() {
    this._setZoom(1), this._canvasWrap?.scrollTo({ top: 0, left: 0 });
  }
  /** One-line description of the selected element for the Element header. */
  _selectionSummary(e) {
    const t = this._floor();
    switch (e.kind) {
      case "wall": {
        const i = t.walls.find((r) => r.id === e.id);
        return i ? `Wall · ${Math.round(Math.hypot(i.x2 - i.x1, i.y2 - i.y1))} units` : "Wall";
      }
      case "opening": {
        const i = t.openings.find((r) => r.id === e.id);
        return i ? `${i.type === "door" ? "Door" : "Window"} · ${Math.round(i.length)} units` : "Opening";
      }
      case "item": {
        const i = t.items.find((r) => r.id === e.id);
        return i?.entity ? `Device · ${i.entity}` : "Device";
      }
      case "text": {
        const r = t.texts.find((s) => s.id === e.id)?.text ?? "";
        return r ? `Text · “${r.length > 24 ? `${r.slice(0, 24)}…` : r}”` : "Text";
      }
      case "furniture": {
        const i = t.furniture.find((s) => s.id === e.id);
        if (!i) return "Furniture";
        const r = q[i.type];
        return `${r.charAt(0).toUpperCase()}${r.slice(1)} · ${Math.round(i.w)}×${Math.round(i.h)}`;
      }
      default: {
        const i = (t.trackers ?? []).find((r) => r.id === e.id);
        return i ? `Tracker · ${Math.round(i.w)}×${Math.round(i.h)}` : "Tracker";
      }
    }
  }
  _renderGrid() {
    const { width: e, height: t } = this._config, i = this.grid, r = `${e}x${t}x${i}`;
    if (this._gridCache?.key === r) return this._gridCache.lines;
    const s = [];
    for (let n = 0; n <= e; n += i)
      s.push(f`<line x1=${n} y1="0" x2=${n} y2=${t} class="grid" />`);
    for (let n = 0; n <= t; n += i)
      s.push(f`<line x1="0" y1=${n} x2=${e} y2=${n} class="grid" />`);
    return this._gridCache = { key: r, lines: s }, s;
  }
  _isSel(e, t) {
    return this._selection.some((i) => i.kind === e && i.id === t);
  }
  /**
   * The second toolbar row: shows controls and hints for whatever you're
   * currently doing — options for the active drawing tool, or actions for the
   * current selection. This keeps contextual controls (which come and go) out
   * of the always-present top row.
   */
  _renderContextBar() {
    const e = this._tool;
    let t, i;
    if (e === "wall")
      t = "Wall", i = d`
        <button
          class=${this._freeWalls ? "" : "active"}
          aria-pressed=${!this._freeWalls}
          title="Snap walls to horizontal/vertical and existing corners (off = draw freely)"
          @click=${() => {
        this._freeWalls = !this._freeWalls;
      }}
        >
          straighten
        </button>
        <span class="ctx-hint">Drag to draw. Endpoints snap to nearby corners to close rooms.</span>
      `;
    else if (e === "tracker")
      t = "Tracker", i = d`
        <span class="ctx-hint"
          >Drag on the canvas to draw the tracked area; bind one or two
          distance sensors in the Element editor.</span
        >
      `;
    else if (e === "door" || e === "window")
      t = e === "door" ? "Door" : "Window", i = d`
        <label class="ctx-field">
          Length
          <input
            class="num"
            type="number"
            min="1"
            .value=${String(this._defaultOpeningLength)}
            title="Default length applied to the next ${e} you place"
            @change=${(r) => {
        this._defaultOpeningLength = Math.max(
          1,
          Number(r.target.value) || this._defaultOpeningLength
        );
      }}
          />
        </label>
        <span class="ctx-hint">Click on a wall to drop a ${e}; it snaps onto the wall.</span>
      `;
    else {
      t = "Select";
      const r = this._selection.length;
      i = r === 0 ? d`<span class="ctx-hint"
              >Click an element to select it, or drag a box to select several.</span
            >` : d`
              <span class="ctx-count">${r} selected</span>
              <span class="ctx-hint">Properties and actions are in the Element section below.</span>
            `;
    }
    return d`
      <div class="context-bar">
        <span class="ctx-label">${t}</span>
        ${i}
        <span class="ctx-divider"></span>
        ${this._renderSnapControl()}
      </div>
    `;
  }
  /**
   * Snap control rendered at the end of the context bar for every tool. The
   * setting governs placement / drag / wall drawing across all tools, so the
   * control needs to be reachable regardless of which tool is active.
   */
  _renderSnapControl() {
    const e = this._snapMode, t = Nt(this._config.snap, this.grid), i = [
      { id: "grid", label: "On" },
      { id: "off", label: "Off" },
      { id: "custom", label: "Custom" }
    ], r = e === "grid" ? `Snapping to the ${this.grid}-unit grid.` : e === "off" ? "No snapping — free placement." : `Snap = ${t}% of grid (${this._resolvedSnap} units).`;
    return d`
      <span class="ctx-field-label">Snap</span>
      <div class="seg" role="group" aria-label="Snap mode">
        ${i.map(
      (s) => d`
            <button
              class=${e === s.id ? "active" : ""}
              aria-pressed=${e === s.id}
              title=${s.id === "grid" ? "Snap to the grid" : s.id === "off" ? "Free placement" : "Custom step (% of grid)"}
              @click=${() => this._setSnapMode(s.id)}
            >
              ${s.label}
            </button>
          `
    )}
      </div>
      ${e === "custom" ? d`<input
              class="num"
              type="number"
              min="1"
              step="5"
              .value=${String(t)}
              title="Custom snap step, as a percentage of the grid"
              @change=${(s) => {
      const n = Math.max(
        1,
        Number(s.target.value) || Rt
      );
      this._patchConfig({ snap: rt(n, this.grid) });
    }}
            /><span class="ctx-field-label">%</span>` : p}
      <span class="ctx-hint">${r}</span>
    `;
  }
  render() {
    if (!this._config) return d`${p}`;
    const e = this._config, t = this._floor(), i = e.floors ?? [], r = !t.walls.length && !t.openings.length && !t.items.length && !t.texts.length && !t.furniture.length && !(t.trackers ?? []).length;
    return d`
      <div
        class="editor ${this._fullscreen ? "fullscreen" : ""}"
        popover=${this._fullscreen ? "manual" : p}
      >
        ${this._floorMenuOpen || this._addMenuOpen ? d`<div
              class="pop-backdrop"
              @click=${() => {
      this._floorMenuOpen = !1, this._addMenuOpen = !1;
    }}
            ></div>` : p}
        <div class="toolbar">
          <!-- Tools — modes; exactly one is active at a time -->
          <div class="seg" role="group" aria-label="Tool">
            ${["select", "wall", "door", "window", "tracker"].map(
      (s) => d`
                <button
                  class=${this._tool === s ? "active" : ""}
                  aria-pressed=${this._tool === s}
                  title=${st[s].label}
                  @click=${() => {
        this._tool = s, this._draft = null, this._draftTracker = null;
      }}
                >
                  <ha-icon icon=${st[s].icon}></ha-icon>${st[s].label}
                </button>`
    )}
          </div>

          <span class="divider"></span>

          <!-- Expand: break out of HA's narrow config dialog into a full-screen
               workspace. Kept next to the tools so it's reachable even when the
               toolbar wraps at dialog width. -->
          <button
            class=${this._fullscreen ? "active expand-toggle" : "expand-toggle"}
            aria-pressed=${this._fullscreen}
            title=${this._fullscreen ? "Exit full screen (Esc)" : "Edit full screen — more room for the canvas"}
            @click=${() => this._toggleFullscreen()}
          >
            <ha-icon icon=${this._fullscreen ? "mdi:fullscreen-exit" : "mdi:fullscreen"}></ha-icon>
            ${this._fullscreen ? "Exit" : "Expand"}
          </button>

          <span class="divider"></span>

          <!-- Insert — one popover for everything droppable on the floor -->
          <span class="pop-wrap">
            <button
              aria-haspopup="true"
              aria-expanded=${this._addMenuOpen}
              @click=${() => {
      this._addMenuOpen = !this._addMenuOpen, this._floorMenuOpen = !1;
    }}
            >
              + Add
            </button>
            ${this._addMenuOpen ? this._renderAddMenu() : p}
          </span>

          <span class="spacer"></span>

          <!-- History -->
          <div class="group">
            <button aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" ?disabled=${!this._history.length} @click=${this._undo}>
              <ha-icon icon="mdi:undo"></ha-icon>
            </button>
            <button aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" ?disabled=${!this._future.length} @click=${this._redo}>
              <ha-icon icon="mdi:redo"></ha-icon>
            </button>
          </div>

          <span class="divider"></span>

          <!-- Floor — switch + add inline; rename/delete behind the gear -->
          <span class="floors pop-wrap">
            <label>floor</label>
            <select @change=${(s) => this._switchFloor(s.target.value)}>
              ${i.map(
      (s) => d`<option value=${s.id} ?selected=${s.id === this._activeFloorId}>${s.name}</option>`
    )}
            </select>
            <button
              aria-label="Add floor"
              title="Add a floor (copies the current walls)"
              @click=${this._addFloor}
            >
              +
            </button>
            <button
              aria-label="Floor settings"
              title="Rename or delete this floor"
              aria-haspopup="true"
              aria-expanded=${this._floorMenuOpen}
              @click=${() => {
      this._floorMenuOpen = !this._floorMenuOpen, this._addMenuOpen = !1;
    }}
            >
              <ha-icon icon="mdi:cog-outline"></ha-icon>
            </button>
            ${this._floorMenuOpen ? d`<div class="pop">
                  ${this._renderHaFloorRow(t)}
                  <div class="pop-row">
                    <label>Rename</label>
                    <input
                      class="floor-name"
                      type="text"
                      .value=${t?.name ?? ""}
                      @change=${(s) => this._renameFloor(this._activeFloorId, s.target.value)}
                    />
                  </div>
                  <button
                    class="danger pop-action"
                    ?disabled=${i.length <= 1}
                    @click=${() => {
      this._deleteFloor(), this._floorMenuOpen = !1;
    }}
                  >
                    <ha-icon icon="mdi:delete-outline"></ha-icon> Delete this floor
                  </button>
                </div>` : p}
          </span>
        </div>

        ${this._renderContextBar()}

        <div class="workspace">
        <div class="canvas-outer">
        <div class="canvas-wrap" tabindex="0" @wheel=${this._onCanvasWheel}>
          <div class="stage" style="aspect-ratio: ${e.width} / ${e.height}; width:${this._zoom * 100}%;">
            <svg
              viewBox="0 0 ${e.width} ${e.height}"
              preserveAspectRatio="none"
              class=${this._tool}
              @pointerdown=${this._onCanvasDown}
              @pointermove=${this._onCanvasMove}
              @pointerup=${this._onCanvasUp}
              @pointercancel=${this._onPointerCancel}
            >
              <rect
                x="0"
                y="0"
                width=${e.width}
                height=${e.height}
                fill=${e.background ?? "var(--card-background-color, #fff)"}
              />
              ${t.image ? f`<image href=${t.image} x="0" y="0" width=${e.width} height=${e.height}
                            preserveAspectRatio="none" opacity=${t.imageOpacity ?? 1} />` : p}
              ${this._renderGrid()}
              ${t.furniture.map((s) => this._renderFurnitureSel(s))}
              ${ae(t.openings, e.width, e.height, this._wallMaskId)}
              ${t.walls.map((s) => this._renderWall(s))}
              ${t.openings.map((s) => this._renderOpeningSel(s))}
              ${(t.trackers ?? []).map((s) => this._renderTrackerSel(s))}
              ${this._draftTracker ? f`<rect class="tracker-draft"
                              x=${Math.min(this._draftTracker.x0, this._draftTracker.x1)}
                              y=${Math.min(this._draftTracker.y0, this._draftTracker.y1)}
                              width=${Math.abs(this._draftTracker.x1 - this._draftTracker.x0)}
                              height=${Math.abs(this._draftTracker.y1 - this._draftTracker.y0)}
                              rx="4" />` : p}
              ${this._draft ? f`<line x1=${this._draft.x1} y1=${this._draft.y1}
                              x2=${this._draft.x2} y2=${this._draft.y2}
                              class="wall draft" mask=${`url(#${this._wallMaskId})`}
                              stroke-width=${D} />` : p}
              ${this._marquee ? f`<rect x=${Math.min(this._marquee.x0, this._marquee.x1)}
                              y=${Math.min(this._marquee.y0, this._marquee.y1)}
                              width=${Math.abs(this._marquee.x1 - this._marquee.x0)}
                              height=${Math.abs(this._marquee.y1 - this._marquee.y0)}
                              class="marquee" />` : p}
            </svg>
            <div class="items">
              ${t.texts.map((s) => this._renderTextOverlay(s, e))}
              ${t.items.map((s) => this._renderItemOverlay(s, e))}
            </div>
          </div>
        </div>
        ${r && !this._draft && !this._draftTracker ? d`<div class="empty-hint">
              <div>
                <b>Draw your first room:</b> pick the <b>Wall</b> tool and drag on the canvas.<br />
                Then drop doors, windows and devices onto it.
              </div>
            </div>` : p}
        <div class="zoom-overlay">
          <button aria-label="Zoom out" title="Zoom out" @click=${() => this._setZoom(this._zoom - 0.25)}>
            <ha-icon icon="mdi:minus"></ha-icon>
          </button>
          <button class="zoom-val-btn" title="Reset zoom to 100%" @click=${() => this._setZoom(1)}>
            ${Math.round(this._zoom * 100)}%
          </button>
          <button aria-label="Zoom in" title="Zoom in" @click=${() => this._setZoom(this._zoom + 0.25)}>
            <ha-icon icon="mdi:plus"></ha-icon>
          </button>
          <button aria-label="Fit to view" title="Fit to view" @click=${this._fitView}>
            <ha-icon icon="mdi:fit-to-screen-outline"></ha-icon>
          </button>
        </div>
        </div>

        <div class="side">
          ${this._renderElementEdit()}
          ${this._renderPanel()}
        </div>
        </div>
      </div>
    `;
  }
  /**
   * `ha-entity-picker` when defined, else a plain entity-id input — mirrors
   * the icon-picker fallback so entity binding never silently dead-ends when
   * the helper load fails or the editor runs outside HA.
   */
  _renderEntityPicker(e, t, i) {
    return customElements.get("ha-entity-picker") ? d`<ha-entity-picker
        .hass=${this.hass}
        .value=${e}
        .includeDomains=${i}
        allow-custom-entity
        @value-changed=${(r) => t(r.detail.value ?? "")}
      ></ha-entity-picker>` : d`<input
      type="text"
      placeholder="sensor.example"
      .value=${e}
      @change=${(r) => t(r.target.value)}
    />`;
  }
  /** Toggle the full-screen workspace. */
  _toggleFullscreen() {
    this._fullscreen = !this._fullscreen, this._fullscreen && this._canvasWrap && (this._canvasWrap.style.width = "", this._canvasWrap.style.height = ""), this._floorMenuOpen = !1, this._addMenuOpen = !1;
  }
  /** The "+ Add" popover: device, text, then every furniture type as its real glyph. */
  _renderAddMenu() {
    const e = () => {
      this._addMenuOpen = !1;
    };
    return d`
      <div class="pop left add-pop">
        <button
          class="add-entry"
          @click=${() => {
      this._addItem("generic"), e();
    }}
        >
          <ha-icon icon="mdi:lightbulb-outline"></ha-icon> Device
        </button>
        <button
          class="add-entry"
          @click=${() => {
      this._addText(), e();
    }}
        >
          <ha-icon icon="mdi:format-text"></ha-icon> Text
        </button>
        <div class="add-furn-grid">
          ${qt.map((t) => {
      const i = Lt[t], r = Math.max(i.w, i.h) * 0.25 + 6, s = `${-i.w / 2 - r} ${-i.h / 2 - r} ${i.w + r * 2} ${i.h + r * 2}`;
      return d`
              <button
                class="furn-cell"
                title=${q[t]}
                @click=${() => {
        this._addFurniture(t), e();
      }}
              >
                <svg viewBox=${s}>
                  ${ct({ type: t, x: 0, y: 0, w: i.w, h: i.h })}
                </svg>
                <span>${q[t]}</span>
              </button>
            `;
    })}
        </div>
      </div>
    `;
  }
  /**
   * Per-element editor area, rendered BELOW the canvas with a small title.
   * Kept separate from the project panel so users can tell the two apart, and
   * separate from the context bar so the bar's height stays stable across
   * selection changes (the canvas no longer jumps when you click around).
   */
  _renderElementEdit() {
    const e = this._selection.length, t = this._primary();
    if (e === 0 || !t)
      return d`
        <section class="edit-area">
          <h3 class="section-title">Element</h3>
          <p class="hint">Select an element on the canvas to edit its properties here.</p>
        </section>
      `;
    const i = e > 1 ? `${e} elements selected` : this._selectionSummary(t), r = e > 1 ? "mdi:select-group" : ci[t.kind];
    return d`
      <section class="edit-area">
        <div class="edit-head">
          <ha-icon icon=${r}></ha-icon>
          <span class="edit-title">${i}</span>
          <span class="head-spacer"></span>
          <button aria-label="Duplicate" title="Duplicate (Ctrl/Cmd+D)" @click=${this._duplicate}>
            <ha-icon icon="mdi:content-duplicate"></ha-icon>
          </button>
          <button class="danger" aria-label="Delete" title="Delete (Del)" @click=${this._deleteSelected}>
            <ha-icon icon="mdi:delete-outline"></ha-icon>
          </button>
        </div>
        ${e > 1 ? d`<p class="hint">
              Edit elements one at a time. Drag any selected element to move the whole group.
            </p>` : d`<div class="rows">${this._renderSelectionEditor()}</div>`}
      </section>
    `;
  }
  _renderWall(e) {
    const t = this._isSel("wall", e.id);
    return f`
      <g>
        <line x1=${e.x1} y1=${e.y1} x2=${e.x2} y2=${e.y2}
              class="wall-hit"
              @pointerdown=${(i) => this._startDrag(i, { kind: "wall", id: e.id })} />
        <line x1=${e.x1} y1=${e.y1} x2=${e.x2} y2=${e.y2}
              class="wall ${t ? "selected" : ""}"
              mask=${`url(#${this._wallMaskId})`}
              stroke-width=${D} stroke-linecap="round" />
        ${t ? f`
                <circle cx=${e.x1} cy=${e.y1} r="9" class="handle"
                        @pointerdown=${(i) => this._startDrag(i, { kind: "wall", id: e.id }, 1)} />
                <circle cx=${e.x2} cy=${e.y2} r="9" class="handle"
                        @pointerdown=${(i) => this._startDrag(i, { kind: "wall", id: e.id }, 2)} />` : p}
      </g>`;
  }
  _renderOpeningSel(e) {
    const t = this._isSel("opening", e.id);
    return f`
      <g class="opening-hit"
         @pointerdown=${(i) => this._startDrag(i, { kind: "opening", id: e.id })}>
        ${oe(e, {
      color: t ? "var(--primary-color, #03a9f4)" : "var(--primary-text-color)",
      open: wt(e),
      // Draw sliding openings partly open in the editor so the slide
      // direction and panel style are visible — a closed slider looks
      // symmetric, which would make the Slide / Style controls appear inert.
      amount: k(e) === "slide" ? 0.55 : void 0
    })}
      </g>`;
  }
  /**
   * Render a Tracker in the editor SVG with its zone outline visible (so the
   * user can grab/resize it) plus a hit overlay for drag-to-move and a dashed
   * selection rectangle when active.
   */
  _renderTrackerSel(e) {
    const t = this._isSel("tracker", e.id), i = Y(this.hass?.states, e.xSensor?.entity), r = Y(this.hass?.states, e.ySensor?.entity), s = Z(this.hass?.states, e.xSensor?.presence), n = Z(this.hass?.states, e.ySensor?.presence);
    return f`
      <g class="tracker-hit ${t ? "selected" : ""}"
         @pointerdown=${(o) => this._startDrag(o, { kind: "tracker", id: e.id })}>
        ${le(e, {
      editing: !0,
      xReading: i,
      yReading: r,
      xPresent: s,
      yPresent: n
    })}
        <rect x=${e.x} y=${e.y} width=${e.w} height=${e.h}
              transform="rotate(${e.angle ?? 0} ${e.x + e.w / 2} ${e.y + e.h / 2})"
              class="tracker-hit-rect" />
        ${t ? f`<rect x=${e.x - 4} y=${e.y - 4}
                        width=${e.w + 8} height=${e.h + 8}
                        transform="rotate(${e.angle ?? 0} ${e.x + e.w / 2} ${e.y + e.h / 2})"
                        class="tracker-outline" />` : p}
      </g>`;
  }
  _renderFurnitureSel(e) {
    const t = this._isSel("furniture", e.id);
    return f`
      <g class="furn-hit ${t ? "selected" : ""}"
         @pointerdown=${(i) => this._startDrag(i, { kind: "furniture", id: e.id })}>
        ${ct(e)}
        ${t ? f`<rect x=${e.x - e.w / 2 - 4} y=${e.y - e.h / 2 - 4}
                        width=${e.w + 8} height=${e.h + 8}
                        transform="rotate(${e.angle ?? 0} ${e.x} ${e.y})"
                        class="furn-outline" />` : p}
      </g>`;
  }
  _renderItemOverlay(e, t) {
    const i = this._isSel("item", e.id), r = e.entity ? this.hass?.states[e.entity] : void 0, s = se(e, r), n = e.name || e.entity || e.kind, o = e.size ?? C, c = e.showIcon ?? !0, l = e.display ?? "badge", a = e.rippleColor ?? "var(--primary-color, #03a9f4)", u = e.rippleSize ?? N, h = d`<div
      class="badge ${c ? "" : "ghost"}"
      style="width:${o}px;height:${o}px;transform:rotate(${e.angle ?? 0}deg);"
    >
      <ha-icon icon=${s} style="--mdc-icon-size:${Math.round(o * 0.62)}px;"></ha-icon>
    </div>`;
    let g;
    return l === "ripple" ? g = X(!0, a, u) : l === "iconRipple" ? g = d`<div class="stack">
        ${X(!0, a, u)}
        <div class="stack-icon">${h}</div>
      </div>` : g = h, d`
      <div
        class="edit-item ${i ? "selected" : ""}"
        style="left:${e.x / t.width * 100}%; top:${e.y / t.height * 100}%;"
        @pointerdown=${(m) => this._onOverlayDown(m, { kind: "item", id: e.id })}
        @pointermove=${this._onOverlayMove}
        @pointerup=${this._onOverlayUp}
        @pointercancel=${this._onPointerCancel}
      >
        ${g}
        <span class="ilabel">${n}</span>
      </div>
    `;
  }
  _renderTextOverlay(e, t) {
    const i = this._isSel("text", e.id);
    return d`
      <div
        class="edit-text ${i ? "selected" : ""}"
        style="left:${e.x / t.width * 100}%; top:${e.y / t.height * 100}%;
               font-size:${e.size ?? I}px;
               color:${e.color ?? "var(--primary-text-color)"};
               transform:translate(-50%,-50%) rotate(${e.angle ?? 0}deg);"
        @pointerdown=${(r) => this._onOverlayDown(r, { kind: "text", id: e.id })}
        @pointermove=${this._onOverlayMove}
        @pointerup=${this._onOverlayUp}
        @pointercancel=${this._onPointerCancel}
      >
        ${e.text || "…"}
      </div>
    `;
  }
  _renderPanel() {
    return d`
      <section class="panel">
        <button
          class="section-toggle"
          aria-expanded=${this._projectOpen}
          @click=${() => {
      this._projectOpen = !this._projectOpen;
    }}
        >
          <ha-icon icon=${this._projectOpen ? "mdi:chevron-down" : "mdi:chevron-right"}></ha-icon>
          <span class="section-title-inline">Project</span>
          ${this._projectOpen ? p : d`<span class="section-summary"
                >${this._config.title || "Untitled"} · ${this._config.width}×${this._config.height}</span
              >`}
        </button>
        ${this._projectOpen ? this._renderPanelBody() : p}
      </section>
    `;
  }
  _renderPanelBody() {
    return d`
      <div class="rows panel-body">
        <div class="row">
          <label>Title</label>
          <input
            type="text"
            .value=${this._config.title ?? ""}
            @change=${(e) => this._patchConfig({ title: e.target.value || void 0 })}
          />
        </div>
        <div class="row">
          <label>Canvas W / H</label>
          <input
            type="number"
            min="1"
            .value=${String(this._config.width)}
            @change=${(e) => this._patchConfig({
      width: Math.max(1, Number(e.target.value) || xt)
    })}
          />
          <input
            type="number"
            min="1"
            .value=${String(this._config.height)}
            @change=${(e) => this._patchConfig({
      height: Math.max(1, Number(e.target.value) || vt)
    })}
          />
        </div>
        <div class="row wide">
          <label>Grid size</label>
          <input
            type="number"
            min="1"
            .value=${String(this.grid)}
            @change=${(e) => this._setGrid(Math.max(1, Number(e.target.value) || nt))}
          />
          <span class="hint">
            Gap between grid lines, in canvas units (canvas is ${this._config.width}×${this._config.height}). Smaller = finer grid, more lines.
          </span>
        </div>
        <div class="row">
          <label>Background</label>
          <input
            type="color"
            .value=${this._config.background ?? "#ffffff"}
            @input=${(e) => this._patchConfigLive({ background: e.target.value })}
          />
          <input
            type="text"
            placeholder="#ffffff or empty"
            .value=${this._config.background ?? ""}
            @change=${(e) => this._patchConfig({ background: e.target.value || void 0 })}
          />
        </div>
        <div class="row wide">
          <label>Bg image</label>
          <input
            type="text"
            placeholder="/local/floorplan.png or URL"
            .value=${this._floor()?.image ?? ""}
            @change=${(e) => this._commitFloor({ image: e.target.value || void 0 })}
          />
        </div>
        ${this._floor()?.image ? d`<div class="row">
              <label>Image opacity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                .value=${String(this._floor()?.imageOpacity ?? 1)}
                @input=${(e) => this._patchFloorLive({
      imageOpacity: Number(e.target.value)
    })}
              />
            </div>` : p}
      </div>
    `;
  }
  /**
   * Shared "Angle" row (slider + number box) used by every rotatable element.
   * Centralizes the wrap-to-0..360 math and guards the number box against a
   * cleared field — `Number("")` is 0 but `Number("abc")`/partial input is
   * NaN, which previously got stored and broke the element's transform.
   */
  _renderAngleRow(e, t, i = t) {
    const r = Math.round(e);
    return d`
      <div class="row">
        <label>Angle</label>
        <input
          type="range"
          min="0"
          max="360"
          .value=${String(e)}
          @input=${(s) => i(Number(s.target.value))}
        />
        <input
          class="num"
          type="number"
          min="0"
          max="360"
          .value=${String(r)}
          @change=${(s) => {
      const n = s.target, o = Number(n.value);
      n.value !== "" && Number.isFinite(o) ? t((o % 360 + 360) % 360) : n.value = String(r);
    }}
        />
      </div>
    `;
  }
  /**
   * Editor fields for the currently-selected element, rendered in the Element
   * section below the canvas (docked beside it in fullscreen). Returns nothing
   * when the selection isn't exactly one element — multi-select and
   * empty-select states are handled by the Element header itself.
   */
  _renderSelectionEditor() {
    const e = this._primary();
    if (!e || this._selection.length !== 1) return d`${p}`;
    if (e.kind === "opening") {
      const t = this._floor().openings.find((i) => i.id === e.id);
      return t ? d`
        <div class="row">
          <label>Type</label>
          <select
            .value=${t.type}
            @change=${(i) => this._updateOpening(t.id, {
        type: i.target.value
      })}
          >
            <option value="door">door</option>
            <option value="window">window</option>
          </select>
        </div>
        <div class="row">
          <label>Motion</label>
          <select
            .value=${k(t)}
            @change=${(i) => {
        const r = i.target.value;
        this._updateOpening(t.id, {
          motion: r === "slide" ? "slide" : void 0,
          ...r === "swing" ? { sliderStyle: void 0 } : {}
        });
      }}
          >
            <option value="swing">swing</option>
            <option value="slide">slide</option>
          </select>
        </div>
        <div class="row">
          <label>Length</label>
          <input
            type="number"
            min="1"
            .value=${String(t.length)}
            @change=${(i) => {
        const r = i.target, s = Number(r.value);
        r.value !== "" && s >= 1 ? this._updateOpening(t.id, { length: s }) : r.value = String(t.length);
      }}
          />
        </div>
        ${t.type === "door" && k(t) === "swing" ? d`
              <div class="row">
                <label>Hinge</label>
                <select
                  .value=${t.flipH ? "right" : "left"}
                  @change=${(i) => this._updateOpening(t.id, {
        flipH: i.target.value === "right" || void 0
      })}
                >
                  <option value="left">left</option>
                  <option value="right">right</option>
                </select>
              </div>` : p}
        ${k(t) === "swing" ? d`
              <div class="row">
                <label>Opens</label>
                <select
                  .value=${t.flipV ? "other" : "this"}
                  @change=${(i) => this._updateOpening(t.id, {
        flipV: i.target.value === "other" || void 0
      })}
                >
                  <option value="this">this side</option>
                  <option value="other">other side</option>
                </select>
              </div>` : p}
        ${k(t) === "slide" ? d`
              ${lt(t) !== "biparting" ? d`
                    <div class="row">
                      <label>Slide</label>
                      <select
                        .value=${t.flipH ? "right" : "left"}
                        @change=${(i) => this._updateOpening(t.id, {
        flipH: i.target.value === "right" || void 0
      })}
                      >
                        <option value="left">to left</option>
                        <option value="right">to right</option>
                      </select>
                    </div>` : p}
              <div class="row">
                <label>Style</label>
                <select
                  .value=${lt(t)}
                  @change=${(i) => {
        const r = i.target.value;
        this._updateOpening(t.id, {
          sliderStyle: r === "single" ? void 0 : r
        });
      }}
                >
                  <option value="single">single</option>
                  <option value="bypass">bypass (stack)</option>
                  <option value="biparting">biparting (split)</option>
                </select>
              </div>` : p}
        <div class="row wide">
          <label>Entity</label>
          ${this._renderEntityPicker(
        t.entity ?? "",
        (i) => {
          const r = i || void 0, s = r ? this.hass?.states[r]?.attributes?.device_class : void 0;
          this._updateOpening(t.id, { entity: r, ...s ? Ze(s) : {} });
        },
        ["binary_sensor", "cover"]
      )}
        </div>
        ${t.entity ? d`<div class="row">
                <label>Invert</label>
                <input
                  type="checkbox"
                  .checked=${t.invert ?? !1}
                  @change=${(i) => this._updateOpening(t.id, {
        invert: i.target.checked || void 0
      })}
                />
              </div>
              <div class="row">
                <label>Active color</label>
                <input
                  type="color"
                  .value=${t.activeColor ?? "#03a9f4"}
                  @input=${(i) => this._updateOpeningLive(t.id, {
        activeColor: i.target.value
      })}
                />
                <input
                  type="text"
                  placeholder="(primary)"
                  .value=${t.activeColor ?? ""}
                  @change=${(i) => this._updateOpening(t.id, {
        activeColor: i.target.value || void 0
      })}
                />
              </div>` : p}
        ${this._renderAngleRow(
        t.angle,
        (i) => this._updateOpening(t.id, { angle: i }),
        (i) => this._updateOpeningLive(t.id, { angle: i })
      )}
      ` : d`${p}`;
    }
    if (e.kind === "item") {
      const t = this._floor().items.find((i) => i.id === e.id);
      return t ? d`
        <div class="row wide">
          <label>Entity</label>
          ${this._renderEntityPicker(
        t.entity,
        (i) => this._updateItem(t.id, { entity: i, kind: qe(i) })
      )}
        </div>
        <div class="row wide">
          <label>2nd entity</label>
          ${this._renderEntityPicker(
        t.secondaryEntity ?? "",
        (i) => this._updateItem(t.id, { secondaryEntity: i || void 0 })
      )}
        </div>
        <div class="row wide">
          <label>Icon</label>
          ${customElements.get("ha-icon-picker") ? d`<ha-icon-picker
                .hass=${this.hass}
                .value=${t.icon ?? ""}
                placeholder=${ie(t.kind)}
                @value-changed=${(i) => this._updateItem(t.id, { icon: i.detail.value || void 0 })}
              ></ha-icon-picker>` : d`<input
                type="text"
                placeholder="mdi:lightbulb (optional)"
                .value=${t.icon ?? ""}
                @change=${(i) => this._updateItem(t.id, {
        icon: i.target.value || void 0
      })}
              />`}
        </div>
        <div class="row">
          <label>Name</label>
          <input
            type="text"
            placeholder="(optional)"
            .value=${t.name ?? ""}
            @change=${(i) => this._updateItem(t.id, { name: i.target.value || void 0 })}
          />
        </div>
        <div class="row">
          <label>Size</label>
          <input
            type="range"
            min="16"
            max="96"
            step="2"
            .value=${String(t.size ?? C)}
            @input=${(i) => this._updateItemLive(t.id, { size: Number(i.target.value) })}
          />
          <input
            class="num"
            type="number"
            min="16"
            max="160"
            .value=${String(t.size ?? C)}
            @change=${(i) => this._updateItem(t.id, {
        size: Number(i.target.value) || C
      })}
          />
        </div>
        ${this._renderAngleRow(
        t.angle ?? 0,
        (i) => this._updateItem(t.id, { angle: i }),
        (i) => this._updateItemLive(t.id, { angle: i })
      )}
        <div class="row">
          <label>Display</label>
          <select
            .value=${t.display ?? "badge"}
            @change=${(i) => this._updateItem(t.id, {
        display: i.target.value
      })}
          >
            <option value="badge">Icon badge</option>
            <option value="ripple">Ripple</option>
            <option value="iconRipple">Icon + ripple</option>
          </select>
        </div>
        ${(t.display ?? "badge") !== "badge" ? d`
              <div class="row">
                <label>Ripple color</label>
                <input
                  type="color"
                  .value=${t.rippleColor ?? "#03a9f4"}
                  @input=${(i) => this._updateItemLive(t.id, {
        rippleColor: i.target.value
      })}
                />
                <input
                  type="text"
                  placeholder="(primary)"
                  .value=${t.rippleColor ?? ""}
                  @change=${(i) => this._updateItem(t.id, {
        rippleColor: i.target.value || void 0
      })}
                />
              </div>
              <div class="row">
                <label>Ripple size</label>
                <input
                  type="range"
                  min="40"
                  max="240"
                  step="4"
                  .value=${String(t.rippleSize ?? N)}
                  @input=${(i) => this._updateItemLive(t.id, {
        rippleSize: Number(i.target.value)
      })}
                />
                <input
                  class="num"
                  type="number"
                  min="40"
                  max="400"
                  .value=${String(t.rippleSize ?? N)}
                  @change=${(i) => this._updateItem(t.id, {
        rippleSize: Number(i.target.value) || N
      })}
                />
              </div>
            ` : p}
        <div class="row">
          <label>Show icon</label>
          <input
            type="checkbox"
            .checked=${t.showIcon ?? !0}
            @change=${(i) => this._updateItem(t.id, { showIcon: i.target.checked })}
          />
        </div>
        <div class="row">
          <label>Show state</label>
          <input
            type="checkbox"
            .checked=${t.showState ?? !1}
            @change=${(i) => this._updateItem(t.id, { showState: i.target.checked })}
          />
        </div>
      ` : d`${p}`;
    }
    if (e.kind === "text") {
      const t = this._floor().texts.find((i) => i.id === e.id);
      return t ? d`
        <div class="row">
          <label>Text</label>
          <input
            type="text"
            .value=${t.text}
            @input=${(i) => this._updateTextLive(t.id, { text: i.target.value })}
          />
        </div>
        <div class="row">
          <label>Size</label>
          <input
            type="range"
            min="8"
            max="80"
            .value=${String(t.size ?? I)}
            @input=${(i) => this._updateTextLive(t.id, { size: Number(i.target.value) })}
          />
          <input
            class="num"
            type="number"
            min="8"
            max="200"
            .value=${String(t.size ?? I)}
            @change=${(i) => this._updateText(t.id, {
        size: Number(i.target.value) || I
      })}
          />
        </div>
        <div class="row">
          <label>Color</label>
          <input
            type="color"
            .value=${t.color ?? "#000000"}
            @input=${(i) => this._updateTextLive(t.id, { color: i.target.value })}
          />
          <input
            type="text"
            placeholder="(theme default)"
            .value=${t.color ?? ""}
            @change=${(i) => this._updateText(t.id, { color: i.target.value || void 0 })}
          />
        </div>
        ${this._renderAngleRow(
        t.angle ?? 0,
        (i) => this._updateText(t.id, { angle: i }),
        (i) => this._updateTextLive(t.id, { angle: i })
      )}
      ` : d`${p}`;
    }
    if (e.kind === "furniture") {
      const t = this._floor().furniture.find((i) => i.id === e.id);
      return t ? d`
        <div class="row">
          <label>Type</label>
          <select
            .value=${t.type}
            @change=${(i) => this._updateFurniture(t.id, {
        type: i.target.value
      })}
          >
            ${qt.map((i) => d`<option value=${i}>${q[i]}</option>`)}
          </select>
        </div>
        <div class="row">
          <label>Width / Height</label>
          <input
            class="num"
            type="number"
            min="10"
            .value=${String(t.w)}
            @change=${(i) => this._updateFurniture(t.id, { w: Number(i.target.value) || t.w })}
          />
          <input
            class="num"
            type="number"
            min="10"
            .value=${String(t.h)}
            @change=${(i) => this._updateFurniture(t.id, { h: Number(i.target.value) || t.h })}
          />
        </div>
        ${this._renderAngleRow(
        t.angle ?? 0,
        (i) => this._updateFurniture(t.id, { angle: i }),
        (i) => this._updateFurnitureLive(t.id, { angle: i })
      )}
        <div class="row">
          <label>Color</label>
          <input
            type="color"
            .value=${t.color ?? "#9e9e9e"}
            @input=${(i) => this._updateFurnitureLive(t.id, { color: i.target.value })}
          />
          <input
            type="text"
            placeholder="(gray)"
            .value=${t.color ?? ""}
            @change=${(i) => this._updateFurniture(t.id, {
        color: i.target.value || void 0
      })}
          />
        </div>
      ` : d`${p}`;
    }
    if (e.kind === "tracker") {
      const t = (this._floor().trackers ?? []).find((i) => i.id === e.id);
      return t ? d`
        ${this._renderTrackerSensorRows(t, "xSensor", "X sensor")}
        ${this._renderTrackerSensorRows(t, "ySensor", "Y sensor")}
        <div class="row">
          <label>Width / Height</label>
          <input
            class="num"
            type="number"
            min="10"
            .value=${String(t.w)}
            @change=${(i) => this._updateTracker(t.id, {
        w: Math.max(10, Number(i.target.value) || t.w)
      })}
          />
          <input
            class="num"
            type="number"
            min="10"
            .value=${String(t.h)}
            @change=${(i) => this._updateTracker(t.id, {
        h: Math.max(10, Number(i.target.value) || t.h)
      })}
          />
        </div>
        <div class="row">
          <label>Position</label>
          <input
            class="num"
            type="number"
            .value=${String(Math.round(t.x))}
            @change=${(i) => {
        const r = i.target, s = Number(r.value);
        r.value !== "" && Number.isFinite(s) ? this._updateTracker(t.id, { x: s }) : r.value = String(Math.round(t.x));
      }}
          />
          <input
            class="num"
            type="number"
            .value=${String(Math.round(t.y))}
            @change=${(i) => {
        const r = i.target, s = Number(r.value);
        r.value !== "" && Number.isFinite(s) ? this._updateTracker(t.id, { y: s }) : r.value = String(Math.round(t.y));
      }}
          />
        </div>
        ${this._renderAngleRow(
        t.angle ?? 0,
        (i) => this._updateTracker(t.id, { angle: i }),
        (i) => this._updateTrackerLive(t.id, { angle: i })
      )}
        <div class="row">
          <label>Color</label>
          <input
            type="color"
            .value=${t.color ?? "#03a9f4"}
            @input=${(i) => this._updateTrackerLive(t.id, { color: i.target.value })}
          />
          <input
            type="text"
            placeholder="(primary)"
            .value=${t.color ?? ""}
            @change=${(i) => this._updateTracker(t.id, {
        color: i.target.value || void 0
      })}
          />
        </div>
        <div class="row">
          <label>Dot size</label>
          <input
            type="range"
            min="6"
            max="40"
            step="1"
            .value=${String(t.dotSize ?? R)}
            @input=${(i) => this._updateTrackerLive(t.id, {
        dotSize: Number(i.target.value)
      })}
          />
          <input
            class="num"
            type="number"
            min="6"
            max="80"
            .value=${String(t.dotSize ?? R)}
            @change=${(i) => this._updateTracker(t.id, {
        dotSize: Number(i.target.value) || R
      })}
          />
        </div>
      ` : d`${p}`;
    }
    if (e.kind === "wall") {
      const t = this._floor().walls.find((s) => s.id === e.id);
      if (!t) return d`${p}`;
      const i = Math.round(Math.hypot(t.x2 - t.x1, t.y2 - t.y1)), r = (s, n) => d`
        <input
          class="num"
          type="number"
          .value=${String(Math.round(s))}
          @change=${(o) => {
        const c = o.target, l = Number(c.value);
        c.value !== "" && Number.isFinite(l) ? n(l) : c.value = String(Math.round(s));
      }}
        />
      `;
      return d`
        <div class="row">
          <label>Start X / Y</label>
          ${r(t.x1, (s) => this._updateWall(t.id, { x1: s }))}
          ${r(t.y1, (s) => this._updateWall(t.id, { y1: s }))}
        </div>
        <div class="row">
          <label>End X / Y</label>
          ${r(t.x2, (s) => this._updateWall(t.id, { x2: s }))}
          ${r(t.y2, (s) => this._updateWall(t.id, { y2: s }))}
        </div>
        <div class="row">
          <label>Length</label>
          <input
            class="num"
            type="number"
            min="1"
            .value=${String(i)}
            @change=${(s) => {
        const n = s.target, o = Number(n.value);
        if (n.value === "" || !(o >= 1)) {
          n.value = String(i);
          return;
        }
        const c = t.x2 - t.x1, l = t.y2 - t.y1, a = Math.hypot(c, l), u = a > 0 ? c / a : 1, h = a > 0 ? l / a : 0;
        this._updateWall(t.id, {
          x2: Math.round(t.x1 + u * o),
          y2: Math.round(t.y1 + h * o)
        });
      }}
          />
          <span class="hint">Resizes from the start point, keeping the direction.</span>
        </div>
        <p class="hint">
          Or drag the line on the canvas to move it, and the round handles to move an endpoint.
        </p>
      `;
    }
    return d`${p}`;
  }
  /**
   * Editor rows for one of a tracker's two sensor mappings (X or Y). Entity
   * picker is always shown; min / max / invert appear once a sensor entity is
   * set so the panel stays compact while empty.
   */
  _renderTrackerSensorRows(e, t, i) {
    const r = e[t];
    return d`
      <div class="row wide">
        <label>${i}</label>
        ${this._renderEntityPicker(
      r?.entity ?? "",
      (s) => {
        s ? this._updateTrackerSensor(e.id, t, { entity: s }) : this._updateTrackerSensor(e.id, t, null);
      },
      ["sensor", "input_number", "number"]
    )}
      </div>
      ${r ? d`<div class="row">
            <label>${i} range</label>
            <input
              class="num"
              type="number"
              step="0.01"
              title="Reading at the near edge"
              .value=${String(r.min)}
              @change=${(s) => {
      const n = s.target, o = Number(n.value);
      n.value !== "" && Number.isFinite(o) ? this._updateTrackerSensor(e.id, t, { min: o }) : n.value = String(r.min);
    }}
            />
            <input
              class="num"
              type="number"
              step="0.01"
              title="Reading at the far edge"
              .value=${String(r.max)}
              @change=${(s) => {
      const n = s.target, o = Number(n.value);
      n.value !== "" && Number.isFinite(o) ? this._updateTrackerSensor(e.id, t, { max: o }) : n.value = String(r.max);
    }}
            />
            <label class="inline-check">
              <input
                type="checkbox"
                .checked=${r.invert ?? !1}
                @change=${(s) => this._updateTrackerSensor(e.id, t, {
      invert: s.target.checked || void 0
    })}
              />
              invert
            </label>
          </div>
          <div class="row wide">
            <label>${i} presence</label>
            ${this._renderEntityPicker(
      r.presence?.entity ?? "",
      (s) => this._updateTrackerSensor(e.id, t, {
        presence: s ? { entity: s, invert: r.presence?.invert } : void 0
      }),
      ["binary_sensor", "input_boolean", "device_tracker"]
    )}
            ${r.presence ? d`<label class="inline-check" title="Treat 'off' as detected">
                  <input
                    type="checkbox"
                    .checked=${r.presence.invert ?? !1}
                    @change=${(s) => this._updateTrackerSensor(e.id, t, {
      presence: {
        entity: r.presence.entity,
        invert: s.target.checked || void 0
      }
    })}
                  />
                  invert
                </label>` : p}
          </div>` : p}
    `;
  }
};
_._nextWallMaskId = 0;
_.styles = Gt`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    /* Full-screen workspace, shown as a popover so the top layer lifts it clear
       of HA's edit dialog (whose surface is transformed — see updated()). The
       resets undo the UA popover defaults: fit-content size, auto margins, a
       solid border and padding. The fixed position only matters to the
       non-popover fallback, where the transformed dialog surface is the
       containing block — there "fullscreen" fills the dialog, not the page. */
    .editor.fullscreen {
      position: fixed;
      inset: 0;
      z-index: 100;
      width: auto;
      height: auto;
      max-width: none;
      max-height: none;
      margin: 0;
      border: none;
      padding: 12px;
      box-sizing: border-box;
      color: inherit;
      background: var(--card-background-color, #fff);
      overflow: hidden;
    }
    /* Toolbar-icon button (Expand/Exit) — match the gear button's icon+label
       alignment so it reads as part of the toolbar. */
    .expand-toggle {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    /* Below the two toolbars: the canvas and the element/project sections.
       Stacked at dialog width; split into canvas + docked side panel when
       expanded so the extra width isn't wasted. */
    .workspace {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    .editor.fullscreen .workspace {
      flex-direction: row;
      align-items: stretch;
      flex: 1 1 auto;
      min-height: 0;
    }
    .editor.fullscreen .canvas-outer {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .editor.fullscreen .canvas-wrap {
      flex: 1 1 auto;
      min-height: 0;
      height: auto;
      resize: none;
    }
    /* Docked inspector — fixed, scrollable column beside the canvas. */
    .editor.fullscreen .side {
      flex: 0 0 340px;
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 2px;
    }
    /* At real dialog width the side panel can drop below instead of squeezing
       the canvas to nothing. */
    @media (max-width: 900px) {
      .editor.fullscreen .workspace {
        flex-direction: column;
        /* Stacked panels can exceed a short viewport (phone landscape) — the
           root clips, so the workspace itself must scroll. */
        overflow-y: auto;
      }
      .editor.fullscreen .side {
        flex: 0 0 auto;
        max-height: 40vh;
      }
    }
    .toolbar {
      display: flex;
      gap: 4px;
      align-items: center;
      flex-wrap: wrap;
    }
    .toolbar .spacer {
      flex: 1;
    }
    /* generic inline cluster of related controls */
    .group {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    /* vertical rule between toolbar groups */
    .divider {
      align-self: stretch;
      width: 1px;
      min-height: 26px;
      margin: 0 4px;
      background: var(--divider-color, #e0e0e0);
    }
    /* tools rendered as a connected segmented control (one active) */
    .seg {
      display: inline-flex;
    }
    .seg button {
      border-radius: 0;
      border-left-width: 0;
    }
    .seg button:first-child {
      border-left-width: 1px;
      border-top-left-radius: 6px;
      border-bottom-left-radius: 6px;
    }
    .seg button:last-child {
      border-top-right-radius: 6px;
      border-bottom-right-radius: 6px;
    }
    /* contextual second row: options/actions for the current tool or selection */
    .context-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 6px;
      padding: 5px 10px;
      min-height: 36px;
      box-sizing: border-box;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 6px;
      background: var(--secondary-background-color, #f5f5f5);
    }
    .context-bar .ctx-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--primary-color, #03a9f4);
      padding-right: 8px;
      margin-right: 2px;
      border-right: 1px solid var(--divider-color, #e0e0e0);
    }
    .context-bar .ctx-hint {
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .context-bar .ctx-count {
      font-size: 12px;
      color: var(--primary-text-color);
    }
    .context-bar button {
      padding: 4px 10px;
      font-size: 13px;
    }
    /* A label + input pair inline in the context bar (e.g. default Length for
       the Door/Window tools). The <label> wraps both so clicking the text
       focuses the input. */
    .context-bar .ctx-field {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .context-bar .ctx-field input.num {
      width: 60px;
    }
    /* Inline label for a control rendered loose in the context bar (e.g. the
       "Snap" word next to the segmented control). */
    .context-bar .ctx-field-label {
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .context-bar input.num {
      width: 60px;
    }
    /* Thin vertical rule separating the tool-specific contents from the
       always-on Snap control on the right side of the context bar. */
    .ctx-divider {
      flex: 0 0 1px;
      align-self: stretch;
      min-height: 22px;
      margin: 0 4px;
      background: var(--divider-color, #e0e0e0);
    }
    button {
      cursor: pointer;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      border-radius: 6px;
      padding: 6px 10px;
      text-transform: capitalize;
    }
    button.active {
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      border-color: var(--primary-color, #03a9f4);
    }
    button.danger {
      color: var(--error-color, #db4437);
    }
    button[disabled] {
      opacity: 0.4;
      cursor: not-allowed;
    }
    /* The canvas is focusable so keyboard shortcuts only fire while working in
       the editor; only show the ring for keyboard focus, not pointer clicks. */
    .canvas-wrap:focus {
      outline: none;
    }
    .canvas-wrap:focus-visible {
      outline: 2px solid var(--primary-color, #03a9f4);
      outline-offset: -2px;
    }
    .canvas-wrap {
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 8px;
      overflow: auto;
      resize: both;
      /* Size to the canvas's own aspect ratio rather than forcing a fixed
         viewport-relative height. This avoids the empty band above and below
         the grid that used to appear with the default 1000×600 canvas, and
         leaves room for the Element / Project sections below. The user can
         still drag-resize via the corner handle (resize: both). */
      min-height: 200px;
      background: var(--secondary-background-color, #f5f5f5);
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
    }
    .stage {
      position: relative;
      width: 100%;
      flex: 0 0 auto;
      margin: auto;
      touch-action: none;
    }
    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
    svg.wall,
    svg.door,
    svg.window,
    svg.tracker {
      cursor: crosshair;
    }
    .grid {
      /* Theme text colour at low opacity so the grid stays visible over a
         background image (and on both light and dark themes); non-scaling-stroke
         keeps the lines a crisp ~1px at any canvas size / zoom. Editor-only —
         the live card never draws a grid. */
      stroke: var(--primary-text-color, #212121);
      stroke-opacity: 0.25;
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
      /* Purely decorative — must never intercept pointers, or a press that lands
         on a grid line would capture the pointer there and break wall drawing. */
      pointer-events: none;
    }
    /* Scoped to <line> so the rule doesn't accidentally match the <svg>,
       which carries the active-tool class (e.g. "wall") on the canvas. A
       bare ".wall" selector matched the SVG too, and because pointer-events
       is inherited in SVG, setting it to none disabled the entire canvas
       — so no pointerdown reached the wall-draw handler. */
    line.wall {
      stroke: var(--primary-text-color);
      /* The wide transparent .wall-hit line beneath handles selection/drag.
         Without this, the visible line (painted on top) swallows clicks on the
         wall body, so you could only grab it just *outside* the body. */
      pointer-events: none;
    }
    line.wall.selected {
      stroke: var(--primary-color, #03a9f4);
    }
    line.wall.draft {
      opacity: 0.5;
      pointer-events: none;
    }
    .fp-door-leaf,
    .fp-leaf-r {
      transform-box: fill-box;
      transition: transform 0.5s ease;
    }
    .fp-door-leaf {
      transform-origin: left center;
    }
    .fp-leaf-r {
      transform-origin: right center;
    }
    .fp-door-leaf rect,
    .fp-leaf-r rect {
      transition: fill 0.5s ease;
    }
    .fp-door-arc {
      transition: stroke-dashoffset 0.5s ease, stroke 0.5s ease;
    }
    .wall-hit {
      stroke: transparent;
      stroke-width: 22;
      cursor: move;
    }
    .opening-hit {
      cursor: move;
    }
    .furn-hit {
      cursor: move;
    }
    .furn-outline {
      fill: none;
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 1.5;
      stroke-dasharray: 6 4;
      pointer-events: none;
    }
    /* Toolbar icons sit inline with their labels; smaller than content icons. */
    .toolbar ha-icon {
      --mdc-icon-size: 16px;
    }
    .seg button {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    /* === Popovers (floor gear, + Add). The backdrop is a fixed transparent
       layer below the popover that closes it on any outside click. === */
    .pop-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .pop {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      z-index: 20;
      min-width: 220px;
      padding: 8px;
      background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    }
    .pop.left {
      left: 0;
      right: auto;
    }
    .pop-backdrop {
      position: fixed;
      inset: 0;
      z-index: 19;
    }
    .pop-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }
    .pop-row label {
      flex: 0 0 60px;
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .pop-row input,
    .pop-row select {
      flex: 1;
      min-width: 0;
      padding: 4px 6px;
      border-radius: 4px;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
    }
    .pop-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      justify-content: center;
      font-size: 13px;
    }
    .add-pop {
      min-width: 300px;
    }
    .add-entry {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      border: none;
      background: none;
      padding: 6px 8px;
      border-radius: 6px;
      text-align: left;
      font-size: 13px;
    }
    .add-entry:hover {
      background: var(--secondary-background-color, #f5f5f5);
    }
    .add-furn-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 4px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--divider-color, #eee);
    }
    .furn-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      border: none;
      background: none;
      padding: 6px 2px;
      border-radius: 6px;
      font-size: 11px;
      color: var(--secondary-text-color);
      text-transform: none;
    }
    .furn-cell:hover {
      background: var(--secondary-background-color, #f5f5f5);
    }
    .furn-cell svg {
      position: static;
      width: 38px;
      height: 30px;
      display: block;
    }
    /* === Canvas chrome: the zoom overlay and first-run hint live on a
       relative wrapper OUTSIDE the scroll container so they don't scroll
       away with the stage. === */
    .canvas-outer {
      position: relative;
    }
    .zoom-overlay {
      position: absolute;
      right: 26px;
      bottom: 12px;
      z-index: 2;
      display: flex;
      gap: 4px;
    }
    .zoom-overlay button {
      display: inline-flex;
      align-items: center;
      padding: 3px 7px;
      font-size: 12px;
      background: var(--card-background-color, #fff);
    }
    .zoom-overlay ha-icon {
      --mdc-icon-size: 15px;
    }
    .zoom-val-btn {
      min-width: 46px;
      justify-content: center;
    }
    .empty-hint {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 16px;
      font-size: 14px;
      line-height: 1.6;
      color: var(--secondary-text-color);
      /* Never block the first wall being drawn straight through the hint. */
      pointer-events: none;
    }
    .floors {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .floors label {
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .floors select,
    .floors .floor-name {
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      border-radius: 6px;
      padding: 6px 8px;
    }
    .floors .floor-name {
      width: 90px;
    }
    .marquee {
      fill: var(--primary-color, #03a9f4);
      fill-opacity: 0.1;
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 1;
      stroke-dasharray: 4 3;
      pointer-events: none;
    }
    .handle {
      fill: var(--primary-color, #03a9f4);
      stroke: var(--card-background-color, #fff);
      stroke-width: 1.5;
      cursor: grab;
    }
    .items {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .edit-item {
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      cursor: move;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      touch-action: none;
    }
    .badge {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--card-background-color, #fff);
      border: 1.5px solid var(--divider-color, #ccc);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary-text-color);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    }
    .edit-item.selected .badge {
      border-color: var(--primary-color, #03a9f4);
      border-width: 2.5px;
    }
    .badge.ghost {
      opacity: 0.35;
      border-style: dashed;
    }
    .stack {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stack-icon {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ripple {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ripple .ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid var(--fp-ripple-color);
      opacity: 0;
    }
    .ripple.active .ring {
      animation: fp-ripple 1.8s ease-out infinite;
    }
    .ripple .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--fp-ripple-color);
      opacity: 0.4;
    }
    .ripple.active .dot {
      opacity: 0.9;
    }
    @keyframes fp-ripple {
      0% {
        transform: scale(0.15);
        opacity: 0.7;
      }
      100% {
        transform: scale(1);
        opacity: 0;
      }
    }
    /* === Tracker (editor + card share the same animation classes). The zone
       outline is editor-only and added by renderTracker when editing:true; in
       the live card only the marker / line shows. Movement transitions are
       applied to the marker group's transform so the dot/triangle glides
       between sensor updates rather than jumping. === */
    /* Scoped to <g> so the rule doesn't also match the <svg>, which carries
       the active-tool class (e.g. "tracker") for cursor styling. A bare
       ".tracker" matched the SVG too, and pointer-events is inherited in
       SVG — so toggling the tracker tool silently killed every pointerdown
       on the canvas, breaking drag-to-draw. Same trap as line.wall above. */
    g.tracker {
      pointer-events: none;
    }
    .tracker-zone {
      transition: opacity 0.2s ease;
    }
    /* Dim the zone when a configured presence sensor reports "clear" so the
       editor visibly confirms the marker is being gated off — without this,
       a user toggling the mock presence sensor would just see the triangle
       vanish with no other feedback. */
    .tracker-zone.presence-gated {
      opacity: 0.35;
    }
    .tracker-hit {
      cursor: move;
    }
    .tracker-hit-rect {
      /* Transparent fill turns the entire zone into a pointer target for drag,
         without obscuring the dashed outline drawn by the renderer. */
      fill: transparent;
      pointer-events: all;
    }
    .tracker-outline {
      fill: none;
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 1.5;
      stroke-dasharray: 6 4;
      pointer-events: none;
    }
    .tracker-draft {
      fill: var(--primary-color, #03a9f4);
      fill-opacity: 0.08;
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 1.5;
      stroke-dasharray: 6 4;
      pointer-events: none;
    }
    .tracker-marker {
      transition: transform 0.4s ease-out;
      transform-box: fill-box;
    }
    .tracker-dot {
      animation: fp-tracker-pulse 1.4s ease-in-out infinite;
      transform-box: fill-box;
      transform-origin: center;
    }
    .tracker-ring {
      animation: fp-tracker-ring 2.2s ease-out infinite;
      opacity: 0;
    }
    .tracker-line {
      transition: transform 0.4s ease-out;
    }
    .tracker-line-stroke {
      opacity: 0.45;
      animation: fp-tracker-pulse 1.6s ease-in-out infinite;
    }
    .tracker-band {
      opacity: 0;
      animation: fp-tracker-band 2.2s ease-out infinite;
    }
    .tracker-placeholder {
      opacity: 0.6;
    }
    @keyframes fp-tracker-pulse {
      0%,
      100% {
        transform: scale(0.9);
        opacity: 0.7;
      }
      50% {
        transform: scale(1.1);
        opacity: 1;
      }
    }
    @keyframes fp-tracker-ring {
      0% {
        r: 0;
        opacity: 0.7;
      }
      100% {
        r: var(--fp-tracker-ring-max, 60px);
        opacity: 0;
      }
    }
    @keyframes fp-tracker-band {
      0% {
        opacity: 0.5;
        stroke-width: 1.5;
      }
      100% {
        opacity: 0;
        stroke-width: 14;
      }
    }
    .edit-text {
      position: absolute;
      pointer-events: auto;
      cursor: move;
      white-space: nowrap;
      font-weight: 500;
      line-height: 1;
      padding: 2px;
      touch-action: none;
    }
    .edit-text.selected {
      outline: 1.5px dashed var(--primary-color, #03a9f4);
      outline-offset: 2px;
    }
    ha-icon {
      --mdc-icon-size: 22px;
    }
    .ilabel {
      font-size: 11px;
      line-height: 1;
      padding: 1px 4px;
      border-radius: 4px;
      background: var(--card-background-color, #fff);
      color: var(--secondary-text-color);
      white-space: nowrap;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* The panel ("Project" config) and the new element-edit area share the
       same boxed look so the two sections below the canvas read as siblings. */
    .panel,
    .edit-area {
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 8px;
      padding: 10px;
    }
    .section-title {
      margin: 0 0 8px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--secondary-text-color);
    }
    /* Element header: kind icon + summary + the selection's actions. */
    .edit-head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    .edit-head ha-icon {
      --mdc-icon-size: 18px;
      color: var(--secondary-text-color);
    }
    .edit-head .edit-title {
      font-size: 13px;
      font-weight: 600;
    }
    .edit-head .head-spacer {
      flex: 1;
    }
    .edit-head button {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
    }
    .edit-head button ha-icon {
      --mdc-icon-size: 16px;
      color: inherit;
    }
    /* Collapsible Project section header. */
    .section-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      border: none;
      background: none;
      padding: 2px 0;
      margin: 0;
      cursor: pointer;
      color: var(--secondary-text-color);
      text-align: left;
    }
    .section-toggle ha-icon {
      --mdc-icon-size: 16px;
    }
    .section-toggle .section-title-inline {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .section-toggle .section-summary {
      font-size: 12px;
      color: var(--secondary-text-color);
      opacity: 0.8;
      text-transform: none;
    }
    .panel-body {
      margin-top: 10px;
    }
    /* Field rows flow into responsive columns so the below-canvas sections
       stay short at HA-dialog width (~700px fits two columns). Rows that
       need the full width (entity pickers, long hints) opt out via .wide. */
    .rows {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      column-gap: 16px;
      align-items: start;
    }
    .rows .row.wide,
    .rows > .hint,
    .rows > p {
      grid-column: 1 / -1;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }
    .row label {
      flex: 0 0 90px;
      font-size: 13px;
      color: var(--secondary-text-color);
    }
    .row input[type="text"],
    .row input[type="number"],
    .row select {
      flex: 1;
      min-width: 0;
      padding: 4px 6px;
      border-radius: 4px;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
    }
    ha-entity-picker,
    ha-icon-picker {
      flex: 1;
      min-width: 0;
    }
    .row input.num {
      flex: 0 0 64px;
    }
    /* Compact inline checkbox+label used inside a .row that already has its
       primary <label> on the left (e.g. the Tracker sensor "invert" toggle). */
    .row .inline-check {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .hint {
      font-size: 13px;
      color: var(--secondary-text-color);
      line-height: 1.5;
    }
  `;
y([
  yt({ attribute: !1 })
], _.prototype, "hass", 2);
y([
  x()
], _.prototype, "_config", 2);
y([
  x()
], _.prototype, "_tool", 2);
y([
  x()
], _.prototype, "_selection", 2);
y([
  x()
], _.prototype, "_activeFloorId", 2);
y([
  x()
], _.prototype, "_draft", 2);
y([
  x()
], _.prototype, "_draftTracker", 2);
y([
  x()
], _.prototype, "_freeWalls", 2);
y([
  x()
], _.prototype, "_defaultOpeningLength", 2);
y([
  x()
], _.prototype, "_marquee", 2);
y([
  x()
], _.prototype, "_history", 2);
y([
  x()
], _.prototype, "_future", 2);
y([
  x()
], _.prototype, "_zoom", 2);
y([
  x()
], _.prototype, "_floorMenuOpen", 2);
y([
  x()
], _.prototype, "_addMenuOpen", 2);
y([
  x()
], _.prototype, "_projectOpen", 2);
y([
  x()
], _.prototype, "_fullscreen", 2);
y([
  $t(".editor")
], _.prototype, "_editorEl", 2);
y([
  $t("svg")
], _.prototype, "_svg", 2);
y([
  $t(".canvas-wrap")
], _.prototype, "_canvasWrap", 2);
_ = y([
  te("easy-floorplan-card-editor")
], _);
const hi = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  get FloorplanCardEditor() {
    return _;
  }
}, Symbol.toStringTag, { value: "Module" })), pi = "0.7.2", ht = window;
ht.customCards = ht.customCards || [];
ht.customCards.push({
  type: "easy-floorplan-card",
  name: "Easy Floorplan",
  description: "Draw a floorplan with walls, doors, windows, furniture and text, then place device/light controls with a visual editor.",
  preview: !1,
  documentationURL: "https://github.com/nicosandller/easy-floorplan"
});
console.info(
  `%c EASY-FLOORPLAN %c ${pi} `,
  "background:#03a9f4;color:#fff",
  "color:#03a9f4"
);
export {
  E as FloorplanCard
};
