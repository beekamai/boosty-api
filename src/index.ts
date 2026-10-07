/* Публичная точка входа библиотеки boosty-api. */
export { API } from "./client";
export type { APIOptions } from "./client";
export { BoostyError, apiPath } from "./http";
export type { HTTPClient, RequestOptions, ApiCore } from "./http";

export { Auth, TokenPersistError } from "./auth/auth";
export type { AuthOptions } from "./auth/auth";
export { AuthData, ABCAuthDataResolver } from "./auth/auth-data";
export type { AuthTokens, AuthCookies } from "./auth/auth-data";
export { FileAuthDataResolver } from "./auth/file-auth-data-resolver";
export { MemoryAuthDataResolver } from "./auth/memory-auth-data-resolver";

/* Модели и типы. content.ts реэкспортит контент-типы из media-types,
   поэтому media-types напрямую не экспортируем (во избежание дублей). */
export * from "./types/base";
export * from "./types/content";
export * from "./types/post";
export * from "./types/comment";
export * from "./types/users";
export * from "./types/subscription";
export * from "./types/subscriber";
export * from "./types/blog";
export * from "./types/media";
export type { MediaType } from "./resources/media";
export * from "./types/messaging";
export * from "./types/notification";
export * from "./types/blacklist";
export * from "./types/deferred-access";
export * from "./types/donator";
export * from "./types/poll";
export * from "./types/reactions";
export * from "./types/counters";
export * from "./types/teaser";
export * from "./types/account";
export * from "./types/income";
export * from "./types/stats";
export * from "./types/search";
export * from "./types/target";
export type { SaleType, SalesSortBy, SalesOrder, SalesListOptions } from "./resources/income";
export type { StatPeriod, StatSourceType, SourceStatOptions, StatEventsOptions, ReportType } from "./resources/stats";
export type { SearchPageOptions, SearchPostsOptions, SearchFeedPostsOptions, SearchBlogPostsOptions } from "./resources/search";
export type { TargetsListOptions } from "./resources/targets";
export type { VoteOptions } from "./resources/social";

/* Утилиты. */
export { renderText } from "./utils/post";
export type { Entity } from "./utils/post";
export { getVideoSizes } from "./utils/video";
export { interactiveLogin } from "./utils/browser_login";
export type { InteractiveLoginOptions } from "./utils/browser_login";
export { textBlock, linkBlock, buildMessage } from "./utils/message";
export type { ContentBlock } from "./utils/message";
