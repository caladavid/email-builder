/**
 * Utilities for handling file assets during import.
 * Includes helpers for detecting file types (images, videos, fonts)
 * and resolving MIME types from file paths.
 * * @module AssetUtils
 */

export const isImageFile = (filename: string): boolean => {
    const exts = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".avif", ".webp2", ".jxl", ".heic", ".heif"];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
    return exts.includes(ext);
};

export const mimeFromPath = (path: string): string => {
    const ext = path.toLowerCase().substring(path.lastIndexOf(".") + 1);
    switch (ext) {
        case "jpg":
        case "jpeg": return "image/jpeg";
        case "png": return "image/png";
        case "gif": return "image/gif";
        case "bmp": return "image/bmp";
        case "webp": return "image/webp";
        case "svg": return "image/svg+xml";
        default: return "application/octet-stream";
    }
};

export const isVideoFile = (filename: string): boolean => {
    const exts = [".mp4", ".webm", ".ogg", ".avi", ".mov"];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
    return exts.includes(ext);
};

export const isAudioFile = (filename: string): boolean => {
    const exts = [".mp3", ".wav", ".ogg", ".aac"];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
    return exts.includes(ext);
};

export const isFontFile = (filename: string): boolean => {
    const exts = [".woff", ".woff2", ".ttf", ".otf", ".eot"];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
    return exts.includes(ext);
};

export const mimeFromFontPath = (path: string): string => {
    const ext = path.toLowerCase().substring(path.lastIndexOf(".") + 1);
    switch (ext) {
        case "woff": return "font/woff";
        case "woff2": return "font/woff2";
        case "ttf": return "font/ttf";
        case "otf": return "font/otf";
        default: return "application/octet-stream";
    }
};