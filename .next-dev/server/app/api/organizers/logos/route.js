"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/organizers/logos/route";
exports.ids = ["app/api/organizers/logos/route"];
exports.modules = {

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "http":
/*!***********************!*\
  !*** external "http" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ "https":
/*!************************!*\
  !*** external "https" ***!
  \************************/
/***/ ((module) => {

module.exports = require("https");

/***/ }),

/***/ "punycode":
/*!***************************!*\
  !*** external "punycode" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("punycode");

/***/ }),

/***/ "stream":
/*!*************************!*\
  !*** external "stream" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("url");

/***/ }),

/***/ "zlib":
/*!***********************!*\
  !*** external "zlib" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("zlib");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Forganizers%2Flogos%2Froute&page=%2Fapi%2Forganizers%2Flogos%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Forganizers%2Flogos%2Froute.ts&appDir=%2FUsers%2FJeanneRolin%2Fresacolo%2FResacolo%2Fsrc%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2FJeanneRolin%2Fresacolo%2FResacolo&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D!":
/*!******************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Forganizers%2Flogos%2Froute&page=%2Fapi%2Forganizers%2Flogos%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Forganizers%2Flogos%2Froute.ts&appDir=%2FUsers%2FJeanneRolin%2Fresacolo%2FResacolo%2Fsrc%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2FJeanneRolin%2Fresacolo%2FResacolo&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D! ***!
  \******************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   originalPathname: () => (/* binding */ originalPathname),\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/future/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/future/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/future/route-kind */ \"(rsc)/./node_modules/next/dist/server/future/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _Users_JeanneRolin_resacolo_Resacolo_src_app_api_organizers_logos_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./src/app/api/organizers/logos/route.ts */ \"(rsc)/./src/app/api/organizers/logos/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"standalone\"\nconst routeModule = new next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/organizers/logos/route\",\n        pathname: \"/api/organizers/logos\",\n        filename: \"route\",\n        bundlePath: \"app/api/organizers/logos/route\"\n    },\n    resolvedPagePath: \"/Users/JeanneRolin/resacolo/Resacolo/src/app/api/organizers/logos/route.ts\",\n    nextConfigOutput,\n    userland: _Users_JeanneRolin_resacolo_Resacolo_src_app_api_organizers_logos_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { requestAsyncStorage, staticGenerationAsyncStorage, serverHooks } = routeModule;\nconst originalPathname = \"/api/organizers/logos/route\";\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        serverHooks,\n        staticGenerationAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIuanM/bmFtZT1hcHAlMkZhcGklMkZvcmdhbml6ZXJzJTJGbG9nb3MlMkZyb3V0ZSZwYWdlPSUyRmFwaSUyRm9yZ2FuaXplcnMlMkZsb2dvcyUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRm9yZ2FuaXplcnMlMkZsb2dvcyUyRnJvdXRlLnRzJmFwcERpcj0lMkZVc2VycyUyRkplYW5uZVJvbGluJTJGcmVzYWNvbG8lMkZSZXNhY29sbyUyRnNyYyUyRmFwcCZwYWdlRXh0ZW5zaW9ucz10c3gmcGFnZUV4dGVuc2lvbnM9dHMmcGFnZUV4dGVuc2lvbnM9anN4JnBhZ2VFeHRlbnNpb25zPWpzJnJvb3REaXI9JTJGVXNlcnMlMkZKZWFubmVSb2xpbiUyRnJlc2Fjb2xvJTJGUmVzYWNvbG8maXNEZXY9dHJ1ZSZ0c2NvbmZpZ1BhdGg9dHNjb25maWcuanNvbiZiYXNlUGF0aD0mYXNzZXRQcmVmaXg9Jm5leHRDb25maWdPdXRwdXQ9c3RhbmRhbG9uZSZwcmVmZXJyZWRSZWdpb249Jm1pZGRsZXdhcmVDb25maWc9ZTMwJTNEISIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBc0c7QUFDdkM7QUFDYztBQUMwQjtBQUN2RztBQUNBO0FBQ0E7QUFDQSx3QkFBd0IsZ0hBQW1CO0FBQzNDO0FBQ0EsY0FBYyx5RUFBUztBQUN2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0EsWUFBWTtBQUNaLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxRQUFRLGlFQUFpRTtBQUN6RTtBQUNBO0FBQ0EsV0FBVyw0RUFBVztBQUN0QjtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ3VIOztBQUV2SCIsInNvdXJjZXMiOlsid2VicGFjazovL3Jlc2Fjb2xvLz9hZTljIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcFJvdXRlUm91dGVNb2R1bGUgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUtbW9kdWxlcy9hcHAtcm91dGUvbW9kdWxlLmNvbXBpbGVkXCI7XG5pbXBvcnQgeyBSb3V0ZUtpbmQgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUta2luZFwiO1xuaW1wb3J0IHsgcGF0Y2hGZXRjaCBhcyBfcGF0Y2hGZXRjaCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL2xpYi9wYXRjaC1mZXRjaFwiO1xuaW1wb3J0ICogYXMgdXNlcmxhbmQgZnJvbSBcIi9Vc2Vycy9KZWFubmVSb2xpbi9yZXNhY29sby9SZXNhY29sby9zcmMvYXBwL2FwaS9vcmdhbml6ZXJzL2xvZ29zL3JvdXRlLnRzXCI7XG4vLyBXZSBpbmplY3QgdGhlIG5leHRDb25maWdPdXRwdXQgaGVyZSBzbyB0aGF0IHdlIGNhbiB1c2UgdGhlbSBpbiB0aGUgcm91dGVcbi8vIG1vZHVsZS5cbmNvbnN0IG5leHRDb25maWdPdXRwdXQgPSBcInN0YW5kYWxvbmVcIlxuY29uc3Qgcm91dGVNb2R1bGUgPSBuZXcgQXBwUm91dGVSb3V0ZU1vZHVsZSh7XG4gICAgZGVmaW5pdGlvbjoge1xuICAgICAgICBraW5kOiBSb3V0ZUtpbmQuQVBQX1JPVVRFLFxuICAgICAgICBwYWdlOiBcIi9hcGkvb3JnYW5pemVycy9sb2dvcy9yb3V0ZVwiLFxuICAgICAgICBwYXRobmFtZTogXCIvYXBpL29yZ2FuaXplcnMvbG9nb3NcIixcbiAgICAgICAgZmlsZW5hbWU6IFwicm91dGVcIixcbiAgICAgICAgYnVuZGxlUGF0aDogXCJhcHAvYXBpL29yZ2FuaXplcnMvbG9nb3Mvcm91dGVcIlxuICAgIH0sXG4gICAgcmVzb2x2ZWRQYWdlUGF0aDogXCIvVXNlcnMvSmVhbm5lUm9saW4vcmVzYWNvbG8vUmVzYWNvbG8vc3JjL2FwcC9hcGkvb3JnYW5pemVycy9sb2dvcy9yb3V0ZS50c1wiLFxuICAgIG5leHRDb25maWdPdXRwdXQsXG4gICAgdXNlcmxhbmRcbn0pO1xuLy8gUHVsbCBvdXQgdGhlIGV4cG9ydHMgdGhhdCB3ZSBuZWVkIHRvIGV4cG9zZSBmcm9tIHRoZSBtb2R1bGUuIFRoaXMgc2hvdWxkXG4vLyBiZSBlbGltaW5hdGVkIHdoZW4gd2UndmUgbW92ZWQgdGhlIG90aGVyIHJvdXRlcyB0byB0aGUgbmV3IGZvcm1hdC4gVGhlc2Vcbi8vIGFyZSB1c2VkIHRvIGhvb2sgaW50byB0aGUgcm91dGUuXG5jb25zdCB7IHJlcXVlc3RBc3luY1N0b3JhZ2UsIHN0YXRpY0dlbmVyYXRpb25Bc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzIH0gPSByb3V0ZU1vZHVsZTtcbmNvbnN0IG9yaWdpbmFsUGF0aG5hbWUgPSBcIi9hcGkvb3JnYW5pemVycy9sb2dvcy9yb3V0ZVwiO1xuZnVuY3Rpb24gcGF0Y2hGZXRjaCgpIHtcbiAgICByZXR1cm4gX3BhdGNoRmV0Y2goe1xuICAgICAgICBzZXJ2ZXJIb29rcyxcbiAgICAgICAgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZVxuICAgIH0pO1xufVxuZXhwb3J0IHsgcm91dGVNb2R1bGUsIHJlcXVlc3RBc3luY1N0b3JhZ2UsIHN0YXRpY0dlbmVyYXRpb25Bc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzLCBvcmlnaW5hbFBhdGhuYW1lLCBwYXRjaEZldGNoLCAgfTtcblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXBwLXJvdXRlLmpzLm1hcCJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Forganizers%2Flogos%2Froute&page=%2Fapi%2Forganizers%2Flogos%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Forganizers%2Flogos%2Froute.ts&appDir=%2FUsers%2FJeanneRolin%2Fresacolo%2FResacolo%2Fsrc%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2FJeanneRolin%2Fresacolo%2FResacolo&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./src/app/api/organizers/logos/route.ts":
/*!***********************************************!*\
  !*** ./src/app/api/organizers/logos/route.ts ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET),\n/* harmony export */   revalidate: () => (/* binding */ revalidate)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n/* harmony import */ var _lib_supabase_server__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @/lib/supabase/server */ \"(rsc)/./src/lib/supabase/server.ts\");\n\n\nconst revalidate = 600;\nasync function GET() {\n    const supabase = (0,_lib_supabase_server__WEBPACK_IMPORTED_MODULE_1__.getServerSupabaseClient)();\n    const { data, error } = await supabase.from(\"organizers\").select(\"id,name,logo_path\").order(\"name\", {\n        ascending: true\n    });\n    if (error || !data) {\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            logos: []\n        }, {\n            status: 200\n        });\n    }\n    const sorted = [\n        ...data\n    ].sort((a, b)=>(a.name ?? \"\").localeCompare(b.name ?? \"\", \"fr\", {\n            sensitivity: \"base\"\n        }));\n    const unique = sorted.reduce((acc, org)=>{\n        const key = (org.name ?? \"\").trim().toLowerCase();\n        if (!key || acc.has(key)) return acc;\n        acc.set(key, org);\n        return acc;\n    }, new Map());\n    const uniqueOrgs = Array.from(unique.values());\n    const logos = (await Promise.all(uniqueOrgs.filter((org)=>org.logo_path).map(async (org)=>{\n        const path = org.logo_path;\n        const { data: signed } = await supabase.storage.from(\"organizer-logo\").createSignedUrl(path, 60 * 15);\n        const signedUrl = signed?.signedUrl;\n        if (signedUrl) {\n            return {\n                id: org.id,\n                name: org.name ?? \"\",\n                logoUrl: signedUrl\n            };\n        }\n        const publicUrl = supabase.storage.from(\"organizer-logo\").getPublicUrl(path).data.publicUrl;\n        if (!publicUrl) return null;\n        return {\n            id: org.id,\n            name: org.name ?? \"\",\n            logoUrl: publicUrl\n        };\n    }))).filter((item)=>Boolean(item));\n    return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        logos\n    });\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvYXBwL2FwaS9vcmdhbml6ZXJzL2xvZ29zL3JvdXRlLnRzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBMkM7QUFDcUI7QUFRekQsTUFBTUUsYUFBYSxJQUFJO0FBRXZCLGVBQWVDO0lBQ3BCLE1BQU1DLFdBQVdILDZFQUF1QkE7SUFDeEMsTUFBTSxFQUFFSSxJQUFJLEVBQUVDLEtBQUssRUFBRSxHQUFHLE1BQU1GLFNBQzNCRyxJQUFJLENBQUMsY0FDTEMsTUFBTSxDQUFDLHFCQUNQQyxLQUFLLENBQUMsUUFBUTtRQUFFQyxXQUFXO0lBQUs7SUFFbkMsSUFBSUosU0FBUyxDQUFDRCxNQUFNO1FBQ2xCLE9BQU9MLHFEQUFZQSxDQUFDVyxJQUFJLENBQUM7WUFBRUMsT0FBTyxFQUFFO1FBQUMsR0FBRztZQUFFQyxRQUFRO1FBQUk7SUFDeEQ7SUFFQSxNQUFNQyxTQUFTO1dBQUlUO0tBQUssQ0FBQ1UsSUFBSSxDQUFDLENBQUNDLEdBQUdDLElBQ2hDLENBQUNELEVBQUVFLElBQUksSUFBSSxFQUFDLEVBQUdDLGFBQWEsQ0FBQ0YsRUFBRUMsSUFBSSxJQUFJLElBQUksTUFBTTtZQUFFRSxhQUFhO1FBQU87SUFHekUsTUFBTUMsU0FBU1AsT0FBT1EsTUFBTSxDQUFDLENBQUNDLEtBQUtDO1FBQ2pDLE1BQU1DLE1BQU0sQ0FBQ0QsSUFBSU4sSUFBSSxJQUFJLEVBQUMsRUFBR1EsSUFBSSxHQUFHQyxXQUFXO1FBQy9DLElBQUksQ0FBQ0YsT0FBT0YsSUFBSUssR0FBRyxDQUFDSCxNQUFNLE9BQU9GO1FBQ2pDQSxJQUFJTSxHQUFHLENBQUNKLEtBQUtEO1FBQ2IsT0FBT0Q7SUFDVCxHQUFHLElBQUlPO0lBRVAsTUFBTUMsYUFBYUMsTUFBTXpCLElBQUksQ0FBQ2MsT0FBT1ksTUFBTTtJQUUzQyxNQUFNckIsUUFBUSxDQUNaLE1BQU1zQixRQUFRQyxHQUFHLENBQ2ZKLFdBQ0dLLE1BQU0sQ0FBQyxDQUFDWixNQUFRQSxJQUFJYSxTQUFTLEVBQzdCQyxHQUFHLENBQUMsT0FBT2Q7UUFDVixNQUFNZSxPQUFPZixJQUFJYSxTQUFTO1FBQzFCLE1BQU0sRUFBRWhDLE1BQU1tQyxNQUFNLEVBQUUsR0FBRyxNQUFNcEMsU0FBU3FDLE9BQU8sQ0FDNUNsQyxJQUFJLENBQUMsa0JBQ0xtQyxlQUFlLENBQUNILE1BQU0sS0FBSztRQUU5QixNQUFNSSxZQUFZSCxRQUFRRztRQUMxQixJQUFJQSxXQUFXO1lBQ2IsT0FBTztnQkFBRUMsSUFBSXBCLElBQUlvQixFQUFFO2dCQUFFMUIsTUFBTU0sSUFBSU4sSUFBSSxJQUFJO2dCQUFJMkIsU0FBU0Y7WUFBVTtRQUNoRTtRQUVBLE1BQU1HLFlBQVkxQyxTQUFTcUMsT0FBTyxDQUFDbEMsSUFBSSxDQUFDLGtCQUFrQndDLFlBQVksQ0FBQ1IsTUFBTWxDLElBQUksQ0FBQ3lDLFNBQVM7UUFDM0YsSUFBSSxDQUFDQSxXQUFXLE9BQU87UUFFdkIsT0FBTztZQUFFRixJQUFJcEIsSUFBSW9CLEVBQUU7WUFBRTFCLE1BQU1NLElBQUlOLElBQUksSUFBSTtZQUFJMkIsU0FBU0M7UUFBVTtJQUNoRSxHQUNKLEVBQ0FWLE1BQU0sQ0FBQyxDQUFDWSxPQUFnQ0MsUUFBUUQ7SUFFbEQsT0FBT2hELHFEQUFZQSxDQUFDVyxJQUFJLENBQUM7UUFBRUM7SUFBTTtBQUNuQyIsInNvdXJjZXMiOlsid2VicGFjazovL3Jlc2Fjb2xvLy4vc3JjL2FwcC9hcGkvb3JnYW5pemVycy9sb2dvcy9yb3V0ZS50cz83NDE4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE5leHRSZXNwb25zZSB9IGZyb20gJ25leHQvc2VydmVyJztcbmltcG9ydCB7IGdldFNlcnZlclN1cGFiYXNlQ2xpZW50IH0gZnJvbSAnQC9saWIvc3VwYWJhc2Uvc2VydmVyJztcblxudHlwZSBPcmdhbml6ZXJMb2dvID0ge1xuICBpZDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIGxvZ29Vcmw6IHN0cmluZztcbn07XG5cbmV4cG9ydCBjb25zdCByZXZhbGlkYXRlID0gNjAwO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gR0VUKCkge1xuICBjb25zdCBzdXBhYmFzZSA9IGdldFNlcnZlclN1cGFiYXNlQ2xpZW50KCk7XG4gIGNvbnN0IHsgZGF0YSwgZXJyb3IgfSA9IGF3YWl0IHN1cGFiYXNlXG4gICAgLmZyb20oJ29yZ2FuaXplcnMnKVxuICAgIC5zZWxlY3QoJ2lkLG5hbWUsbG9nb19wYXRoJylcbiAgICAub3JkZXIoJ25hbWUnLCB7IGFzY2VuZGluZzogdHJ1ZSB9KTtcblxuICBpZiAoZXJyb3IgfHwgIWRhdGEpIHtcbiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBsb2dvczogW10gfSwgeyBzdGF0dXM6IDIwMCB9KTtcbiAgfVxuXG4gIGNvbnN0IHNvcnRlZCA9IFsuLi5kYXRhXS5zb3J0KChhLCBiKSA9PlxuICAgIChhLm5hbWUgPz8gJycpLmxvY2FsZUNvbXBhcmUoYi5uYW1lID8/ICcnLCAnZnInLCB7IHNlbnNpdGl2aXR5OiAnYmFzZScgfSlcbiAgKTtcblxuICBjb25zdCB1bmlxdWUgPSBzb3J0ZWQucmVkdWNlKChhY2MsIG9yZykgPT4ge1xuICAgIGNvbnN0IGtleSA9IChvcmcubmFtZSA/PyAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKCFrZXkgfHwgYWNjLmhhcyhrZXkpKSByZXR1cm4gYWNjO1xuICAgIGFjYy5zZXQoa2V5LCBvcmcpO1xuICAgIHJldHVybiBhY2M7XG4gIH0sIG5ldyBNYXA8c3RyaW5nLCAodHlwZW9mIHNvcnRlZClbbnVtYmVyXT4oKSk7XG5cbiAgY29uc3QgdW5pcXVlT3JncyA9IEFycmF5LmZyb20odW5pcXVlLnZhbHVlcygpKTtcblxuICBjb25zdCBsb2dvcyA9IChcbiAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgIHVuaXF1ZU9yZ3NcbiAgICAgICAgLmZpbHRlcigob3JnKSA9PiBvcmcubG9nb19wYXRoKVxuICAgICAgICAubWFwKGFzeW5jIChvcmcpID0+IHtcbiAgICAgICAgICBjb25zdCBwYXRoID0gb3JnLmxvZ29fcGF0aCBhcyBzdHJpbmc7XG4gICAgICAgICAgY29uc3QgeyBkYXRhOiBzaWduZWQgfSA9IGF3YWl0IHN1cGFiYXNlLnN0b3JhZ2VcbiAgICAgICAgICAgIC5mcm9tKCdvcmdhbml6ZXItbG9nbycpXG4gICAgICAgICAgICAuY3JlYXRlU2lnbmVkVXJsKHBhdGgsIDYwICogMTUpO1xuXG4gICAgICAgICAgY29uc3Qgc2lnbmVkVXJsID0gc2lnbmVkPy5zaWduZWRVcmw7XG4gICAgICAgICAgaWYgKHNpZ25lZFVybCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgaWQ6IG9yZy5pZCwgbmFtZTogb3JnLm5hbWUgPz8gJycsIGxvZ29Vcmw6IHNpZ25lZFVybCB9O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHB1YmxpY1VybCA9IHN1cGFiYXNlLnN0b3JhZ2UuZnJvbSgnb3JnYW5pemVyLWxvZ28nKS5nZXRQdWJsaWNVcmwocGF0aCkuZGF0YS5wdWJsaWNVcmw7XG4gICAgICAgICAgaWYgKCFwdWJsaWNVcmwpIHJldHVybiBudWxsO1xuXG4gICAgICAgICAgcmV0dXJuIHsgaWQ6IG9yZy5pZCwgbmFtZTogb3JnLm5hbWUgPz8gJycsIGxvZ29Vcmw6IHB1YmxpY1VybCB9O1xuICAgICAgICB9KVxuICAgIClcbiAgKS5maWx0ZXIoKGl0ZW0pOiBpdGVtIGlzIE9yZ2FuaXplckxvZ28gPT4gQm9vbGVhbihpdGVtKSk7XG5cbiAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgbG9nb3MgfSk7XG59XG4iXSwibmFtZXMiOlsiTmV4dFJlc3BvbnNlIiwiZ2V0U2VydmVyU3VwYWJhc2VDbGllbnQiLCJyZXZhbGlkYXRlIiwiR0VUIiwic3VwYWJhc2UiLCJkYXRhIiwiZXJyb3IiLCJmcm9tIiwic2VsZWN0Iiwib3JkZXIiLCJhc2NlbmRpbmciLCJqc29uIiwibG9nb3MiLCJzdGF0dXMiLCJzb3J0ZWQiLCJzb3J0IiwiYSIsImIiLCJuYW1lIiwibG9jYWxlQ29tcGFyZSIsInNlbnNpdGl2aXR5IiwidW5pcXVlIiwicmVkdWNlIiwiYWNjIiwib3JnIiwia2V5IiwidHJpbSIsInRvTG93ZXJDYXNlIiwiaGFzIiwic2V0IiwiTWFwIiwidW5pcXVlT3JncyIsIkFycmF5IiwidmFsdWVzIiwiUHJvbWlzZSIsImFsbCIsImZpbHRlciIsImxvZ29fcGF0aCIsIm1hcCIsInBhdGgiLCJzaWduZWQiLCJzdG9yYWdlIiwiY3JlYXRlU2lnbmVkVXJsIiwic2lnbmVkVXJsIiwiaWQiLCJsb2dvVXJsIiwicHVibGljVXJsIiwiZ2V0UHVibGljVXJsIiwiaXRlbSIsIkJvb2xlYW4iXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./src/app/api/organizers/logos/route.ts\n");

/***/ }),

/***/ "(rsc)/./src/lib/supabase/config.ts":
/*!************************************!*\
  !*** ./src/lib/supabase/config.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   getSupabaseEnv: () => (/* binding */ getSupabaseEnv)\n/* harmony export */ });\nfunction readEnv(name) {\n    const value = process.env[name];\n    return value && value.length > 0 ? value : undefined;\n}\nfunction getSupabaseEnv() {\n    const url = readEnv(\"NEXT_PUBLIC_SUPABASE_URL\");\n    const anonKey = readEnv(\"NEXT_PUBLIC_SUPABASE_ANON_KEY\");\n    const serviceRoleKey = readEnv(\"SUPABASE_SERVICE_ROLE_KEY\");\n    if (!url || !anonKey) {\n        throw new Error(\"Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.\");\n    }\n    return {\n        url,\n        anonKey,\n        serviceRoleKey\n    };\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvbGliL3N1cGFiYXNlL2NvbmZpZy50cyIsIm1hcHBpbmdzIjoiOzs7O0FBTUEsU0FBU0EsUUFBUUMsSUFBWTtJQUMzQixNQUFNQyxRQUFRQyxRQUFRQyxHQUFHLENBQUNILEtBQUs7SUFDL0IsT0FBT0MsU0FBU0EsTUFBTUcsTUFBTSxHQUFHLElBQUlILFFBQVFJO0FBQzdDO0FBRU8sU0FBU0M7SUFDZCxNQUFNQyxNQUFNUixRQUFRO0lBQ3BCLE1BQU1TLFVBQVVULFFBQVE7SUFDeEIsTUFBTVUsaUJBQWlCVixRQUFRO0lBRS9CLElBQUksQ0FBQ1EsT0FBTyxDQUFDQyxTQUFTO1FBQ3BCLE1BQU0sSUFBSUUsTUFDUjtJQUVKO0lBRUEsT0FBTztRQUFFSDtRQUFLQztRQUFTQztJQUFlO0FBQ3hDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vcmVzYWNvbG8vLi9zcmMvbGliL3N1cGFiYXNlL2NvbmZpZy50cz84OTA3Il0sInNvdXJjZXNDb250ZW50IjpbInR5cGUgU3VwYWJhc2VFbnYgPSB7XG4gIHVybDogc3RyaW5nO1xuICBhbm9uS2V5OiBzdHJpbmc7XG4gIHNlcnZpY2VSb2xlS2V5Pzogc3RyaW5nO1xufTtcblxuZnVuY3Rpb24gcmVhZEVudihuYW1lOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBjb25zdCB2YWx1ZSA9IHByb2Nlc3MuZW52W25hbWVdO1xuICByZXR1cm4gdmFsdWUgJiYgdmFsdWUubGVuZ3RoID4gMCA/IHZhbHVlIDogdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3VwYWJhc2VFbnYoKTogU3VwYWJhc2VFbnYge1xuICBjb25zdCB1cmwgPSByZWFkRW52KCdORVhUX1BVQkxJQ19TVVBBQkFTRV9VUkwnKTtcbiAgY29uc3QgYW5vbktleSA9IHJlYWRFbnYoJ05FWFRfUFVCTElDX1NVUEFCQVNFX0FOT05fS0VZJyk7XG4gIGNvbnN0IHNlcnZpY2VSb2xlS2V5ID0gcmVhZEVudignU1VQQUJBU0VfU0VSVklDRV9ST0xFX0tFWScpO1xuXG4gIGlmICghdXJsIHx8ICFhbm9uS2V5KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ1N1cGFiYXNlIGlzIG5vdCBjb25maWd1cmVkLiBTZXQgTkVYVF9QVUJMSUNfU1VQQUJBU0VfVVJMIGFuZCBORVhUX1BVQkxJQ19TVVBBQkFTRV9BTk9OX0tFWS4nXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiB7IHVybCwgYW5vbktleSwgc2VydmljZVJvbGVLZXkgfTtcbn1cbiJdLCJuYW1lcyI6WyJyZWFkRW52IiwibmFtZSIsInZhbHVlIiwicHJvY2VzcyIsImVudiIsImxlbmd0aCIsInVuZGVmaW5lZCIsImdldFN1cGFiYXNlRW52IiwidXJsIiwiYW5vbktleSIsInNlcnZpY2VSb2xlS2V5IiwiRXJyb3IiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./src/lib/supabase/config.ts\n");

/***/ }),

/***/ "(rsc)/./src/lib/supabase/server.ts":
/*!************************************!*\
  !*** ./src/lib/supabase/server.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   getServerSupabaseClient: () => (/* binding */ getServerSupabaseClient)\n/* harmony export */ });\n/* harmony import */ var _supabase_supabase_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @supabase/supabase-js */ \"(rsc)/./node_modules/@supabase/supabase-js/dist/module/index.js\");\n/* harmony import */ var _config__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./config */ \"(rsc)/./src/lib/supabase/config.ts\");\n\n\nfunction getServerSupabaseClient() {\n    if (globalThis.__supabaseServerClient) {\n        return globalThis.__supabaseServerClient;\n    }\n    const { url, anonKey, serviceRoleKey } = (0,_config__WEBPACK_IMPORTED_MODULE_0__.getSupabaseEnv)();\n    const client = (0,_supabase_supabase_js__WEBPACK_IMPORTED_MODULE_1__.createClient)(url, serviceRoleKey ?? anonKey, {\n        auth: {\n            persistSession: false\n        }\n    });\n    globalThis.__supabaseServerClient = client;\n    return client;\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvbGliL3N1cGFiYXNlL3NlcnZlci50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7QUFBMEU7QUFFaEM7QUFPbkMsU0FBU0U7SUFDZCxJQUFJQyxXQUFXQyxzQkFBc0IsRUFBRTtRQUNyQyxPQUFPRCxXQUFXQyxzQkFBc0I7SUFDMUM7SUFFQSxNQUFNLEVBQUVDLEdBQUcsRUFBRUMsT0FBTyxFQUFFQyxjQUFjLEVBQUUsR0FBR04sdURBQWNBO0lBQ3ZELE1BQU1PLFNBQVNSLG1FQUFZQSxDQUFXSyxLQUFLRSxrQkFBa0JELFNBQVM7UUFDcEVHLE1BQU07WUFBRUMsZ0JBQWdCO1FBQU07SUFDaEM7SUFFQVAsV0FBV0Msc0JBQXNCLEdBQUdJO0lBQ3BDLE9BQU9BO0FBQ1QiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9yZXNhY29sby8uL3NyYy9saWIvc3VwYWJhc2Uvc2VydmVyLnRzPzJlOGUiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY3JlYXRlQ2xpZW50LCB0eXBlIFN1cGFiYXNlQ2xpZW50IH0gZnJvbSAnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJztcbmltcG9ydCB0eXBlIHsgRGF0YWJhc2UgfSBmcm9tICdAL3R5cGVzL3N1cGFiYXNlJztcbmltcG9ydCB7IGdldFN1cGFiYXNlRW52IH0gZnJvbSAnLi9jb25maWcnO1xuXG5kZWNsYXJlIGdsb2JhbCB7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby12YXJcbiAgdmFyIF9fc3VwYWJhc2VTZXJ2ZXJDbGllbnQ6IFN1cGFiYXNlQ2xpZW50PERhdGFiYXNlPiB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNlcnZlclN1cGFiYXNlQ2xpZW50KCk6IFN1cGFiYXNlQ2xpZW50PERhdGFiYXNlPiB7XG4gIGlmIChnbG9iYWxUaGlzLl9fc3VwYWJhc2VTZXJ2ZXJDbGllbnQpIHtcbiAgICByZXR1cm4gZ2xvYmFsVGhpcy5fX3N1cGFiYXNlU2VydmVyQ2xpZW50O1xuICB9XG5cbiAgY29uc3QgeyB1cmwsIGFub25LZXksIHNlcnZpY2VSb2xlS2V5IH0gPSBnZXRTdXBhYmFzZUVudigpO1xuICBjb25zdCBjbGllbnQgPSBjcmVhdGVDbGllbnQ8RGF0YWJhc2U+KHVybCwgc2VydmljZVJvbGVLZXkgPz8gYW5vbktleSwge1xuICAgIGF1dGg6IHsgcGVyc2lzdFNlc3Npb246IGZhbHNlIH1cbiAgfSk7XG5cbiAgZ2xvYmFsVGhpcy5fX3N1cGFiYXNlU2VydmVyQ2xpZW50ID0gY2xpZW50O1xuICByZXR1cm4gY2xpZW50O1xufVxuIl0sIm5hbWVzIjpbImNyZWF0ZUNsaWVudCIsImdldFN1cGFiYXNlRW52IiwiZ2V0U2VydmVyU3VwYWJhc2VDbGllbnQiLCJnbG9iYWxUaGlzIiwiX19zdXBhYmFzZVNlcnZlckNsaWVudCIsInVybCIsImFub25LZXkiLCJzZXJ2aWNlUm9sZUtleSIsImNsaWVudCIsImF1dGgiLCJwZXJzaXN0U2Vzc2lvbiJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./src/lib/supabase/server.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/@supabase","vendor-chunks/whatwg-url","vendor-chunks/tr46","vendor-chunks/webidl-conversions"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Forganizers%2Flogos%2Froute&page=%2Fapi%2Forganizers%2Flogos%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Forganizers%2Flogos%2Froute.ts&appDir=%2FUsers%2FJeanneRolin%2Fresacolo%2FResacolo%2Fsrc%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2FJeanneRolin%2Fresacolo%2FResacolo&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=standalone&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();