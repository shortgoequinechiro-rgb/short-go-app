(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/lib/supabase.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/index.mjs [app-client] (ecmascript) <locals>");
;
const supabaseUrl = ("TURBOPACK compile-time value", "https://pyuarwwhmtoflyzwblbn.supabase.co");
const supabaseAnonKey = ("TURBOPACK compile-time value", "sb_publishable_b7Xr7G-eDtcCANZluzNpXA_XsJBLans");
const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(supabaseUrl, supabaseAnonKey);
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/components/NavBar.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>NavBar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/image.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/lib/supabase.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
function NavBar() {
    _s();
    const [userEmail, setUserEmail] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [menuOpen, setMenuOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const menuRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NavBar.useEffect": ()=>{
            __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.getSession().then({
                "NavBar.useEffect": ({ data })=>{
                    setUserEmail(data.session?.user?.email ?? null);
                }
            }["NavBar.useEffect"]).catch({
                "NavBar.useEffect": ()=>{
                // Offline — try to get cached session
                // Supabase stores session in localStorage so getSession() should still work,
                // but if it throws, just leave email null (NavBar won't render)
                }
            }["NavBar.useEffect"]);
            const { data: { subscription } } = __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.onAuthStateChange({
                "NavBar.useEffect": (_event, session)=>{
                    setUserEmail(session?.user?.email ?? null);
                }
            }["NavBar.useEffect"]);
            return ({
                "NavBar.useEffect": ()=>subscription.unsubscribe()
            })["NavBar.useEffect"];
        }
    }["NavBar.useEffect"], []);
    // Close menu when clicking outside
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NavBar.useEffect": ()=>{
            function handleClickOutside(e) {
                if (menuRef.current && !menuRef.current.contains(e.target)) {
                    setMenuOpen(false);
                }
            }
            document.addEventListener('mousedown', handleClickOutside);
            return ({
                "NavBar.useEffect": ()=>document.removeEventListener('mousedown', handleClickOutside)
            })["NavBar.useEffect"];
        }
    }["NavBar.useEffect"], []);
    // Close menu on route change
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "NavBar.useEffect": ()=>{
            setMenuOpen(false);
        }
    }["NavBar.useEffect"], [
        pathname
    ]);
    // Don't render on public/marketing pages or when unauthenticated
    const isPublicPage = pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname?.startsWith('/onboarding') || pathname === '/contact';
    if (isPublicPage || !userEmail) return null;
    async function handleSignOut() {
        await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.signOut();
        router.push('/login');
    }
    const isAnatomy = pathname?.startsWith('/anatomy');
    const isHorse = pathname?.startsWith('/horses');
    const isCalendar = pathname?.startsWith('/calendar');
    const isAccount = pathname?.startsWith('/account') || pathname?.startsWith('/billing');
    const navLinks = [
        {
            href: '/calendar',
            label: '📅 Scheduler',
            hidden: isCalendar
        },
        {
            href: '/account',
            label: 'Account',
            hidden: isAccount
        }
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
        className: "sticky top-0 z-50 border-b border-[#1a3358] bg-[#0f2040] shadow-lg",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    href: "/dashboard",
                    className: "flex min-w-0 items-center gap-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "relative h-12 w-12 flex-shrink-0",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                src: "/logo-gold.png",
                                alt: "Stride",
                                fill: true,
                                className: "object-contain"
                            }, void 0, false, {
                                fileName: "[project]/app/components/NavBar.tsx",
                                lineNumber: 79,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/app/components/NavBar.tsx",
                            lineNumber: 78,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "hidden flex-col leading-none sm:flex",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "whitespace-nowrap text-lg font-extrabold tracking-widest text-white md:text-xl",
                                    children: "STRIDE"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/NavBar.tsx",
                                    lineNumber: 87,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-[10px] font-medium uppercase tracking-[0.2em] text-[#c9a227]",
                                    children: "Equine & Canine Chiro"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/NavBar.tsx",
                                    lineNumber: 90,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/NavBar.tsx",
                            lineNumber: 86,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/NavBar.tsx",
                    lineNumber: 77,
                    columnNumber: 9
                }, this),
                (isHorse || isAnatomy) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "hidden items-center gap-1.5 text-sm md:flex",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            href: "/dashboard",
                            className: "text-blue-200 transition-colors hover:text-white",
                            children: "Dashboard"
                        }, void 0, false, {
                            fileName: "[project]/app/components/NavBar.tsx",
                            lineNumber: 99,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "text-white/30",
                            children: "/"
                        }, void 0, false, {
                            fileName: "[project]/app/components/NavBar.tsx",
                            lineNumber: 102,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "font-medium text-white",
                            children: isAnatomy ? 'Anatomy Viewer' : 'Patient Record'
                        }, void 0, false, {
                            fileName: "[project]/app/components/NavBar.tsx",
                            lineNumber: 103,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/NavBar.tsx",
                    lineNumber: 98,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-center gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "hidden max-w-[200px] truncate text-sm text-blue-200 xl:block",
                            children: userEmail
                        }, void 0, false, {
                            fileName: "[project]/app/components/NavBar.tsx",
                            lineNumber: 112,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "hidden items-center gap-2 sm:flex",
                            children: [
                                !isCalendar && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/calendar",
                                    className: "whitespace-nowrap rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20",
                                    children: "📅 Scheduler"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/NavBar.tsx",
                                    lineNumber: 119,
                                    columnNumber: 15
                                }, this),
                                !isAccount && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/account",
                                    className: "whitespace-nowrap rounded-xl border border-white/25 bg-transparent px-3 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white",
                                    children: "Account"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/NavBar.tsx",
                                    lineNumber: 127,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: handleSignOut,
                                    className: "whitespace-nowrap rounded-xl border border-white/25 bg-transparent px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10",
                                    children: "Sign Out"
                                }, void 0, false, {
                                    fileName: "[project]/app/components/NavBar.tsx",
                                    lineNumber: 134,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/NavBar.tsx",
                            lineNumber: 117,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "relative sm:hidden",
                            ref: menuRef,
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>setMenuOpen((o)=>!o),
                                    "aria-label": "Open menu",
                                    className: "flex h-9 w-9 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white transition hover:bg-white/20",
                                    children: menuOpen ? /* X icon */ /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                        xmlns: "http://www.w3.org/2000/svg",
                                        className: "h-5 w-5",
                                        fill: "none",
                                        viewBox: "0 0 24 24",
                                        stroke: "currentColor",
                                        strokeWidth: 2,
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round",
                                            d: "M6 18L18 6M6 6l12 12"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/NavBar.tsx",
                                            lineNumber: 152,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/NavBar.tsx",
                                        lineNumber: 151,
                                        columnNumber: 17
                                    }, this) : /* Hamburger icon */ /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                        xmlns: "http://www.w3.org/2000/svg",
                                        className: "h-5 w-5",
                                        fill: "none",
                                        viewBox: "0 0 24 24",
                                        stroke: "currentColor",
                                        strokeWidth: 2,
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round",
                                            d: "M4 6h16M4 12h16M4 18h16"
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/NavBar.tsx",
                                            lineNumber: 157,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/app/components/NavBar.tsx",
                                        lineNumber: 156,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/components/NavBar.tsx",
                                    lineNumber: 144,
                                    columnNumber: 13
                                }, this),
                                menuOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-2xl border border-[#1a3358] bg-[#0f2040] shadow-2xl",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "border-b border-white/10 px-4 py-3",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "truncate text-xs text-blue-200",
                                                children: userEmail
                                            }, void 0, false, {
                                                fileName: "[project]/app/components/NavBar.tsx",
                                                lineNumber: 167,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/app/components/NavBar.tsx",
                                            lineNumber: 166,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "p-1.5",
                                            children: [
                                                navLinks.map((link)=>link.hidden ? null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                        href: link.href,
                                                        className: "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10",
                                                        children: link.label
                                                    }, link.href, false, {
                                                        fileName: "[project]/app/components/NavBar.tsx",
                                                        lineNumber: 174,
                                                        columnNumber: 23
                                                    }, this)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    onClick: handleSignOut,
                                                    className: "mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-red-300 transition hover:bg-white/10",
                                                    children: "Sign Out"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/components/NavBar.tsx",
                                                    lineNumber: 184,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/app/components/NavBar.tsx",
                                            lineNumber: 171,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/components/NavBar.tsx",
                                    lineNumber: 164,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/app/components/NavBar.tsx",
                            lineNumber: 143,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/NavBar.tsx",
                    lineNumber: 110,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/components/NavBar.tsx",
            lineNumber: 74,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/components/NavBar.tsx",
        lineNumber: 73,
        columnNumber: 5
    }, this);
}
_s(NavBar, "Lsd2kiDnkngJIKkBfOD5K2w0t54=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"]
    ];
});
_c = NavBar;
var _c;
__turbopack_context__.k.register(_c, "NavBar");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/lib/offlineDb.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cacheAppointments",
    ()=>cacheAppointments,
    "cacheHorses",
    ()=>cacheHorses,
    "cacheOwners",
    ()=>cacheOwners,
    "cacheVisits",
    ()=>cacheVisits,
    "fetchWithOfflineFallback",
    ()=>fetchWithOfflineFallback,
    "getCachedAppointments",
    ()=>getCachedAppointments,
    "getCachedHorseById",
    ()=>getCachedHorseById,
    "getCachedHorses",
    ()=>getCachedHorses,
    "getCachedHorsesByOwner",
    ()=>getCachedHorsesByOwner,
    "getCachedOwnerById",
    ()=>getCachedOwnerById,
    "getCachedOwners",
    ()=>getCachedOwners,
    "getCachedVisitsByHorse",
    ()=>getCachedVisitsByHorse,
    "getCachedVisitsByPractitioner",
    ()=>getCachedVisitsByPractitioner,
    "getPendingCount",
    ()=>getPendingCount,
    "offlineDb",
    ()=>offlineDb,
    "refreshOfflineCache",
    ()=>refreshOfflineCache,
    "syncPendingData",
    ()=>syncPendingData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$dexie$2f$import$2d$wrapper$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/dexie/import-wrapper.mjs [app-client] (ecmascript)");
;
// ── Database ──────────────────────────────────────────────────────────────────
class OfflineDB extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$dexie$2f$import$2d$wrapper$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"] {
    // Read cache tables
    cachedOwners;
    cachedHorses;
    cachedVisits;
    cachedAppointments;
    // Write queue tables
    pendingHorses;
    pendingIntakeForms;
    pendingVisits;
    pendingAppointments;
    constructor(){
        super('shortGoOfflineDB');
        this.version(1).stores({
            pendingHorses: 'localId, ownerId',
            pendingIntakeForms: 'localId, ownerId'
        });
        this.version(2).stores({
            // Read cache
            cachedOwners: 'id, practitioner_id, cachedAt',
            cachedHorses: 'id, owner_id, practitioner_id, cachedAt',
            cachedVisits: 'id, horse_id, practitioner_id, cachedAt',
            cachedAppointments: 'id, owner_id, appointment_date, practitioner_id, cachedAt',
            // Write queue
            pendingHorses: 'localId, ownerId',
            pendingIntakeForms: 'localId, ownerId',
            pendingVisits: 'localId, horseId',
            pendingAppointments: 'localId, ownerId'
        });
    }
}
const offlineDb = new OfflineDB();
// ── Cache helpers (call these after successful Supabase fetches) ────────────
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours
;
async function cacheOwners(owners) {
    const now = Date.now();
    const rows = owners.map((o)=>({
            ...o,
            cachedAt: now
        }));
    await offlineDb.cachedOwners.bulkPut(rows);
}
async function cacheHorses(horses) {
    const now = Date.now();
    const rows = horses.map((h)=>({
            ...h,
            cachedAt: now
        }));
    await offlineDb.cachedHorses.bulkPut(rows);
}
async function cacheVisits(visits) {
    const now = Date.now();
    const rows = visits.map((v)=>({
            ...v,
            cachedAt: now
        }));
    await offlineDb.cachedVisits.bulkPut(rows);
}
async function cacheAppointments(appointments) {
    const now = Date.now();
    const rows = appointments.map((a)=>({
            ...a,
            cachedAt: now
        }));
    await offlineDb.cachedAppointments.bulkPut(rows);
}
async function getCachedOwners(practitionerId) {
    const cutoff = Date.now() - CACHE_TTL;
    return offlineDb.cachedOwners.where('practitioner_id').equals(practitionerId).and((o)=>o.cachedAt > cutoff).toArray();
}
async function getCachedHorses(practitionerId) {
    const cutoff = Date.now() - CACHE_TTL;
    return offlineDb.cachedHorses.where('practitioner_id').equals(practitionerId).and((h)=>h.cachedAt > cutoff).toArray();
}
async function getCachedVisitsByHorse(horseId) {
    const cutoff = Date.now() - CACHE_TTL;
    return offlineDb.cachedVisits.where('horse_id').equals(horseId).and((v)=>v.cachedAt > cutoff).toArray();
}
async function getCachedAppointments(practitionerId) {
    const cutoff = Date.now() - CACHE_TTL;
    return offlineDb.cachedAppointments.where('practitioner_id').equals(practitionerId).and((a)=>a.cachedAt > cutoff).toArray();
}
async function getCachedHorsesByOwner(ownerId) {
    const cutoff = Date.now() - CACHE_TTL;
    return offlineDb.cachedHorses.where('owner_id').equals(ownerId).and((h)=>h.cachedAt > cutoff).toArray();
}
async function getCachedHorseById(horseId) {
    return offlineDb.cachedHorses.get(horseId);
}
async function getCachedOwnerById(ownerId) {
    return offlineDb.cachedOwners.get(ownerId);
}
async function getCachedVisitsByPractitioner(practitionerId) {
    const cutoff = Date.now() - CACHE_TTL;
    return offlineDb.cachedVisits.where('practitioner_id').equals(practitionerId).and((v)=>v.cachedAt > cutoff).toArray();
}
async function fetchWithOfflineFallback(onlineFetcher, offlineFallback) {
    if (!navigator.onLine) {
        return {
            data: await offlineFallback(),
            fromCache: true
        };
    }
    try {
        const data = await onlineFetcher();
        return {
            data,
            fromCache: false
        };
    } catch  {
        return {
            data: await offlineFallback(),
            fromCache: true
        };
    }
}
async function syncPendingData(supabase) {
    if (!navigator.onLine) return {
        synced: 0,
        failed: 0
    };
    const { data: { user } } = await supabase.auth.getUser();
    const practitionerId = user?.id || null;
    let synced = 0;
    let failed = 0;
    // ── Sync pending horses ──
    const horses = await offlineDb.pendingHorses.toArray();
    for (const horse of horses){
        const { error } = await supabase.from('horses').insert({
            id: horse.localId,
            owner_id: horse.ownerId,
            name: horse.name,
            breed: horse.breed,
            age: horse.age,
            sex: horse.sex,
            species: horse.species,
            archived: horse.archived,
            practitioner_id: practitionerId
        });
        if (!error || error.code === '23505') {
            await offlineDb.pendingHorses.delete(horse.localId);
            if (!error) synced++;
        } else {
            failed++;
        }
    }
    // ── Sync pending intake forms ──
    const forms = await offlineDb.pendingIntakeForms.toArray();
    for (const form of forms){
        const { error } = await supabase.from('intake_forms').insert({
            id: form.localId,
            owner_id: form.ownerId,
            horse_id: form.localHorseId,
            submitted_at: form.submittedAt,
            form_date: form.formDate,
            referral_source: form.referralSource,
            animal_name: form.animalName,
            animal_age: form.animalAge,
            animal_breed: form.animalBreed,
            animal_dob: form.animalDob,
            animal_gender: form.animalGender,
            animal_height: form.animalHeight,
            animal_color: form.animalColor,
            reason_for_care: form.reasonForCare,
            health_problems: form.healthProblems,
            behavior_changes: form.behaviorChanges,
            conditions_illnesses: form.conditionsIllnesses,
            medications_supplements: form.medicationsSupplements,
            use_of_animal: form.useOfAnimal,
            previous_chiro_care: form.previousChiroCare,
            consent_signed: form.consentSigned,
            signature_data: form.signatureData,
            signed_name: form.signedName,
            practitioner_id: practitionerId
        });
        if (!error || error.code === '23505') {
            await offlineDb.pendingIntakeForms.delete(form.localId);
            if (!error) synced++;
        } else {
            failed++;
        }
    }
    // ── Sync pending visits ──
    const visits = await offlineDb.pendingVisits.toArray();
    for (const visit of visits){
        const { error } = await supabase.from('visits').insert({
            id: visit.localId,
            horse_id: visit.horseId,
            visit_date: visit.visitDate,
            reason_for_visit: visit.reasonForVisit,
            subjective: visit.subjective,
            objective: visit.objective,
            assessment: visit.assessment,
            plan: visit.plan,
            quick_notes: visit.quickNotes,
            practitioner_id: practitionerId
        });
        if (!error || error.code === '23505') {
            await offlineDb.pendingVisits.delete(visit.localId);
            if (!error) synced++;
        } else {
            failed++;
        }
    }
    // ── Sync pending appointments ──
    const appointments = await offlineDb.pendingAppointments.toArray();
    for (const appt of appointments){
        const { error } = await supabase.from('appointments').insert({
            id: appt.localId,
            horse_id: appt.horseId,
            owner_id: appt.ownerId,
            appointment_date: appt.appointmentDate,
            appointment_time: appt.appointmentTime,
            duration_minutes: appt.durationMinutes,
            location: appt.location,
            reason: appt.reason,
            status: appt.status,
            provider_name: appt.providerName,
            notes: appt.notes,
            practitioner_id: practitionerId
        });
        if (!error || error.code === '23505') {
            await offlineDb.pendingAppointments.delete(appt.localId);
            if (!error) synced++;
        } else {
            failed++;
        }
    }
    return {
        synced,
        failed
    };
}
async function getPendingCount() {
    const [horses, forms, visits, appointments] = await Promise.all([
        offlineDb.pendingHorses.count(),
        offlineDb.pendingIntakeForms.count(),
        offlineDb.pendingVisits.count(),
        offlineDb.pendingAppointments.count()
    ]);
    return horses + forms + visits + appointments;
}
async function refreshOfflineCache(supabase) {
    if (!navigator.onLine) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
        // Cache owners
        const { data: owners } = await supabase.from('owners').select('id, full_name, phone, email, address, archived, practitioner_id').eq('practitioner_id', user.id).eq('archived', false);
        if (owners) await cacheOwners(owners);
        // Cache horses
        const { data: horses } = await supabase.from('horses').select('id, owner_id, name, breed, age, sex, species, discipline, barn_location, archived, practitioner_id').eq('practitioner_id', user.id).eq('archived', false);
        if (horses) await cacheHorses(horses);
        // Cache recent visits (last 90 days)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const { data: visits } = await supabase.from('visits').select('id, horse_id, visit_date, reason_for_visit, subjective, objective, assessment, plan, quick_notes, practitioner_id').eq('practitioner_id', user.id).gte('visit_date', ninetyDaysAgo.toISOString().split('T')[0]);
        if (visits) await cacheVisits(visits);
        // Cache upcoming appointments (next 30 days)
        const today = new Date().toISOString().split('T')[0];
        const thirtyDaysOut = new Date();
        thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
        const { data: appointments } = await supabase.from('appointments').select('id, horse_id, owner_id, appointment_date, appointment_time, duration_minutes, location, reason, status, provider_name, notes, practitioner_id').eq('practitioner_id', user.id).gte('appointment_date', today).lte('appointment_date', thirtyDaysOut.toISOString().split('T')[0]);
        if (appointments) await cacheAppointments(appointments);
    } catch (err) {
        console.warn('[offlineDb] cache refresh failed:', err);
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/components/OfflineSync.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>OfflineSync
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/lib/supabase.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$offlineDb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/lib/offlineDb.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
function OfflineSync() {
    _s();
    const [isOnline, setIsOnline] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [pendingCount, setPendingCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const [syncing, setSyncing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [justSynced, setJustSynced] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Sync pending spine assessments stored in localStorage
    const syncPendingSpineAssessments = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "OfflineSync.useCallback[syncPendingSpineAssessments]": async ()=>{
            try {
                const pending = JSON.parse(localStorage.getItem('pendingSpineAssessments') || '[]');
                if (pending.length === 0) return;
                const { data: { user } } = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.getUser();
                const synced = [];
                for (const item of pending){
                    const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('spine_assessments').insert({
                        horse_id: item.horse_id,
                        visit_id: item.visit_id,
                        findings: item.findings,
                        notes: item.notes,
                        assessed_at: item.assessed_at,
                        practitioner_id: user?.id
                    });
                    if (!error || error.code === '23505') synced.push(item.localId);
                }
                const remaining = pending.filter({
                    "OfflineSync.useCallback[syncPendingSpineAssessments].remaining": (p)=>!synced.includes(p.localId)
                }["OfflineSync.useCallback[syncPendingSpineAssessments].remaining"]);
                localStorage.setItem('pendingSpineAssessments', JSON.stringify(remaining));
            } catch  {}
        }
    }["OfflineSync.useCallback[syncPendingSpineAssessments]"], []);
    const runSync = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "OfflineSync.useCallback[runSync]": async ()=>{
            const count = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$offlineDb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getPendingCount"])();
            const spineCount = JSON.parse(localStorage.getItem('pendingSpineAssessments') || '[]').length;
            if (count === 0 && spineCount === 0) return;
            setSyncing(true);
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$offlineDb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["syncPendingData"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"]);
            await syncPendingSpineAssessments();
            const remaining = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$offlineDb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getPendingCount"])();
            const spineRemaining = JSON.parse(localStorage.getItem('pendingSpineAssessments') || '[]').length;
            setPendingCount(remaining + spineRemaining);
            setSyncing(false);
            if (remaining === 0 && spineRemaining === 0) {
                setJustSynced(true);
                setTimeout({
                    "OfflineSync.useCallback[runSync]": ()=>setJustSynced(false)
                }["OfflineSync.useCallback[runSync]"], 4000);
            }
        }
    }["OfflineSync.useCallback[runSync]"], [
        syncPendingSpineAssessments
    ]);
    // Check initial state, refresh cache, and sync pending
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OfflineSync.useEffect": ()=>{
            setIsOnline(navigator.onLine);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$offlineDb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getPendingCount"])().then({
                "OfflineSync.useEffect": (c)=>{
                    const spineCount = JSON.parse(localStorage.getItem('pendingSpineAssessments') || '[]').length;
                    setPendingCount(c + spineCount);
                }
            }["OfflineSync.useEffect"]);
            // Refresh offline cache in the background when online
            if (navigator.onLine) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$offlineDb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["refreshOfflineCache"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"]).catch({
                    "OfflineSync.useEffect": ()=>{}
                }["OfflineSync.useEffect"]);
                // Also sync any pending items from a previous offline session
                runSync();
            }
        }
    }["OfflineSync.useEffect"], [
        runSync
    ]);
    // Listen for connectivity changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OfflineSync.useEffect": ()=>{
            function handleOnline() {
                setIsOnline(true);
                // When coming back online: sync pending data then refresh cache
                runSync().then({
                    "OfflineSync.useEffect.handleOnline": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$offlineDb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["refreshOfflineCache"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"]).catch({
                            "OfflineSync.useEffect.handleOnline": ()=>{}
                        }["OfflineSync.useEffect.handleOnline"])
                }["OfflineSync.useEffect.handleOnline"]);
            }
            function handleOffline() {
                setIsOnline(false);
            }
            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);
            return ({
                "OfflineSync.useEffect": ()=>{
                    window.removeEventListener('online', handleOnline);
                    window.removeEventListener('offline', handleOffline);
                }
            })["OfflineSync.useEffect"];
        }
    }["OfflineSync.useEffect"], [
        runSync
    ]);
    // Poll pending count periodically so the badge stays accurate
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OfflineSync.useEffect": ()=>{
            const interval = setInterval({
                "OfflineSync.useEffect.interval": async ()=>{
                    const count = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$offlineDb$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getPendingCount"])();
                    const spineCount = JSON.parse(localStorage.getItem('pendingSpineAssessments') || '[]').length;
                    setPendingCount(count + spineCount);
                }
            }["OfflineSync.useEffect.interval"], 5000);
            return ({
                "OfflineSync.useEffect": ()=>clearInterval(interval)
            })["OfflineSync.useEffect"];
        }
    }["OfflineSync.useEffect"], []);
    // Offline banner
    if (!isOnline) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "h-2 w-2 rounded-full bg-white opacity-80 animate-pulse"
                }, void 0, false, {
                    fileName: "[project]/app/components/OfflineSync.tsx",
                    lineNumber: 102,
                    columnNumber: 9
                }, this),
                "Offline mode — data saved locally",
                pendingCount > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs",
                    children: [
                        pendingCount,
                        " pending"
                    ]
                }, void 0, true, {
                    fileName: "[project]/app/components/OfflineSync.tsx",
                    lineNumber: 105,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/components/OfflineSync.tsx",
            lineNumber: 101,
            columnNumber: 7
        }, this);
    }
    // Just synced confirmation
    if (justSynced) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg",
            children: "✓ Offline data synced"
        }, void 0, false, {
            fileName: "[project]/app/components/OfflineSync.tsx",
            lineNumber: 116,
            columnNumber: 7
        }, this);
    }
    // Pending badge when online but still has queued items
    if (pendingCount > 0) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            onClick: runSync,
            className: "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-slate-700 transition",
            children: syncing ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "h-2 w-2 rounded-full bg-white animate-pulse"
                    }, void 0, false, {
                        fileName: "[project]/app/components/OfflineSync.tsx",
                        lineNumber: 131,
                        columnNumber: 13
                    }, this),
                    "Syncing…"
                ]
            }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-slate-900",
                        children: pendingCount
                    }, void 0, false, {
                        fileName: "[project]/app/components/OfflineSync.tsx",
                        lineNumber: 136,
                        columnNumber: 13
                    }, this),
                    "Tap to sync offline data"
                ]
            }, void 0, true)
        }, void 0, false, {
            fileName: "[project]/app/components/OfflineSync.tsx",
            lineNumber: 125,
            columnNumber: 7
        }, this);
    }
    return null;
}
_s(OfflineSync, "v/eRkVC86xdxkSb0QthkJhlf0aY=");
_c = OfflineSync;
var _c;
__turbopack_context__.k.register(_c, "OfflineSync");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/components/BillingGate.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>BillingGate
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/lib/supabase.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
// Paths that bypass billing/onboarding checks entirely.
// - /: landing page (unauthenticated visitors, exact match only)
// - /login, /signup: unauthenticated entry points
// - /onboarding: new user setup (can't check billing before onboarding completes)
// - /intake, /consent: accessed by horse owners without any account
// - /billing: the paywall destination itself
const PUBLIC_PREFIXES = [
    '/login',
    '/signup',
    '/onboarding',
    '/intake',
    '/consent',
    '/billing',
    '/contact'
];
function BillingGate({ children }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    const [ready, setReady] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const checked = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const isPublic = pathname === '/' || PUBLIC_PREFIXES.some((p)=>pathname?.startsWith(p));
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "BillingGate.useEffect": ()=>{
            // Public paths always pass through without any checks
            if (isPublic) {
                setReady(true);
                return;
            }
            // Only run once per mount cycle to avoid double-checks
            if (checked.current) return;
            checked.current = true;
            async function checkAccess() {
                // When offline, skip billing checks entirely — let the user work with cached data
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    setReady(true);
                    return;
                }
                // Get current user
                const { data: { user } } = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.getUser();
                if (!user) {
                    // Not logged in — let the individual page handle its own auth redirect
                    setReady(true);
                    return;
                }
                const { data: { session } } = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.getSession();
                if (!session) {
                    setReady(true);
                    return;
                }
                try {
                    // Ensure practitioner record exists (creates a 14-day trial for brand-new signups)
                    const res = await fetch('/api/billing/ensure-practitioner', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            token: session.access_token
                        })
                    });
                    if (!res.ok) {
                        // If the check fails, don't block the user — fail open
                        console.error('BillingGate: ensure-practitioner returned', res.status);
                        setReady(true);
                        return;
                    }
                    const practitioner = await res.json();
                    // 1. Onboarding check — new users must complete setup first
                    if (!practitioner.onboarding_complete) {
                        router.push('/onboarding');
                        return;
                    }
                    // 2. Billing check — block access if trial expired or subscription is not active
                    const status = practitioner.subscription_status;
                    const trialEnd = practitioner.trial_ends_at ? new Date(practitioner.trial_ends_at) : null;
                    const trialExpired = trialEnd ? trialEnd < new Date() : false;
                    const hasAccess = status === 'active' || status === 'trialing' && !trialExpired;
                    if (!hasAccess) {
                        router.push('/billing');
                        return;
                    }
                } catch (err) {
                    // On network error, fail open so we don't lock users out unexpectedly
                    console.error('BillingGate error:', err);
                }
                setReady(true);
            }
            checkAccess();
        }
    }["BillingGate.useEffect"], [
        pathname,
        isPublic,
        router
    ]);
    // Show a minimal loading state while checking (only on gated routes)
    if (!ready && !isPublic) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex min-h-screen items-center justify-center bg-slate-50",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-slate-400 text-sm",
                children: "Loading…"
            }, void 0, false, {
                fileName: "[project]/app/components/BillingGate.tsx",
                lineNumber: 110,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/components/BillingGate.tsx",
            lineNumber: 109,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: children
    }, void 0, false);
}
_s(BillingGate, "rXOalKB91Pj5jaNPYo7GoW1aack=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"]
    ];
});
_c = BillingGate;
var _c;
__turbopack_context__.k.register(_c, "BillingGate");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_580f2af4._.js.map