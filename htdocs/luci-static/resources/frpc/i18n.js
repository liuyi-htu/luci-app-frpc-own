'use strict';
'require baseclass';

var patterns = [
 [
  "^frpc\\ (.+)\\ failed$",
  "frpc %s failed"
 ],
 [
  "^Authentication\\ field\\ is\\ required:\\ (.+)$",
  "Authentication field is required: %s"
 ],
 [
  "^Authentication\\ field\\ contains\\ control\\ characters:\\ (.+)$",
  "Authentication field contains control characters: %s"
 ],
 [
  "^Invalid\\ numeric\\ field:\\ (.+)$",
  "Invalid numeric field: %s"
 ],
 [
  "^Numeric\\ field\\ is\\ out\\ of\\ range:\\ (.+)$",
  "Numeric field is out of range: %s"
 ],
 [
  "^Update\\ failed:\\ (.+)$",
  "Update failed: %s"
 ],
 [
  "^Current\\ frpc\\ (.+)\\ is\\ not\\ older\\ than\\ candidate\\ (.+)\\.\\ No\\ update\\ needed\\.$",
  "Current frpc %s is not older than candidate %s. No update needed."
 ],
 [
  "^Current\\ frpc\\ (.+)\\ is\\ up\\ to\\ date\\.$",
  "Current frpc %s is up to date."
 ],
 [
  "^Installing\\ frpc\\ (.+)\\.\\.\\.$",
  "Installing frpc %s..."
 ],
 [
  "^frpc\\ updated\\ from\\ (.+)\\ to\\ (.+)\\.$",
  "frpc updated from %s to %s."
 ],
 [
  "^frpc\\ updated\\ to\\ (.+)\\.$",
  "frpc updated to %s."
 ],
 [
  "^Current\\ frpc\\ (.+)\\ is\\ not\\ older\\ than\\ the\\ latest\\ official\\ release\\ (.+)\\.\\ No\\ update\\ needed\\.$",
  "Current frpc %s is not older than the latest official release %s. No update needed."
 ],
 [
  "^Current\\ frpc\\ (.+)\\ is\\ the\\ latest\\ official\\ release\\.$",
  "Current frpc %s is the latest official release."
 ],
 [
  "^Found\\ frpc\\ (.+)\\.\\ Detecting\\ system\\ architecture\\.\\.\\.$",
  "Found frpc %s. Detecting system architecture..."
 ],
 [
  "^Downloading\\ frpc\\ (.+)\\.\\.\\.$",
  "Downloading frpc %s..."
 ]
];
var legacyMessages = {
 "\u547d\u4ee4\u6267\u884c\u5931\u8d25": "Command failed",
 "\u672a\u5b89\u88c5": "Not installed",
 "\u64cd\u4f5c\u5931\u8d25": "Operation failed",
 "\u63d0\u793a": "Notice",
 "\u5173\u95ed": "Close",
 "\u53ea\u80fd\u4f7f\u7528 1-64 \u4f4d\u5b57\u6bcd\u3001\u6570\u5b57\u3001\u70b9\u3001\u4e0b\u5212\u7ebf\u6216\u6a2a\u7ebf\u3002": "Use 1-64 letters, digits, dots, underscores, or hyphens.",
 "\u4e0d\u80fd\u4e3a\u7a7a\u4e14\u4e0d\u80fd\u5305\u542b\u7a7a\u767d\u5b57\u7b26\u3002": "This field is required and must not contain whitespace.",
 "\u8bf7\u5148\u505c\u6b62 frpc\uff0c\u518d\u8fdb\u884c\u64cd\u4f5c\u3002": "Stop frpc before making changes.",
 "frpc \u6b63\u5728\u8fd0\u884c\uff0c\u8bf7\u5148\u505c\u6b62\u670d\u52a1\u518d\u4fdd\u5b58\u914d\u7f6e\u3002": "frpc is running. Stop the service before saving configuration.",
 "\u64cd\u4f5c\u6b63\u5728\u8fdb\u884c\uff0c\u8bf7\u7a0d\u540e\u518d\u4fdd\u5b58\u3002": "An operation is in progress. Try saving again later.",
 "\u4ee3\u7406\u914d\u7f6e\u5df2\u4fdd\u5b58\u3002": "Proxy configuration saved.",
 "\u4e0d\u80fd\u4e3a\u7a7a\u3002": "This field is required.",
 "\u8ba4\u8bc1\u4fe1\u606f\u5df2\u4fdd\u5b58\u3002": "Authentication saved.",
 "\u65e0\u6cd5\u8bfb\u53d6 frpc \u8fd0\u884c\u72b6\u6001\u3002": "Unable to read frpc service status.",
 "\u8fd0\u884c\u4e2d": "Running",
 "\u5df2\u505c\u6b62": "Stopped",
 "\u5df2\u542f\u7528": "Enabled",
 "\u672a\u542f\u7528": "Disabled",
 "\u505c\u6b62\u670d\u52a1": "Stop service",
 "\u542f\u52a8\u670d\u52a1": "Start service",
 "\u5173\u95ed\u5f00\u673a\u81ea\u542f": "Disable autostart",
 "\u542f\u7528\u5f00\u673a\u81ea\u542f": "Enable autostart",
 "frpc \u5df2\u542f\u52a8\u3002": "frpc started.",
 "frpc \u5df2\u505c\u6b62\u3002": "frpc stopped.",
 "\u5df2\u542f\u7528\u5f00\u673a\u81ea\u542f\u3002": "Autostart enabled.",
 "\u5df2\u5173\u95ed\u5f00\u673a\u81ea\u542f\u3002": "Autostart disabled.",
 "\u670d\u52a1\u72b6\u6001": "Service status",
 "\u5f00\u673a\u81ea\u542f": "Autostart",
 "\u7248\u672c": "Version",
 "\u8fd0\u884c\u914d\u7f6e": "Runtime configuration",
 "\u5c1a\u65e0\u8fd0\u884c\u914d\u7f6e\u3002": "No runtime configuration is available.",
 "\u6b63\u5728\u540c\u6b65\u8fd0\u884c\u914d\u7f6e\u2026": "Synchronizing runtime configuration...",
 "\u8bfb\u53d6\u8fd0\u884c\u914d\u7f6e\u5931\u8d25\u3002": "Failed to read runtime configuration.",
 "\u70b9\u51fb\u201c\u5237\u65b0\u65e5\u5fd7\u201d\u8bfb\u53d6\u65e5\u5fd7\u3002": "Click Refresh log to read the log.",
 "\u6682\u65e0\u65e5\u5fd7\u3002": "No log entries.",
 "\u5237\u65b0\u65e5\u5fd7": "Refresh log",
 "\u786e\u8ba4\u6e05\u7a7a\u5f53\u524d\u65e5\u5fd7\uff1f": "Clear the selected log?",
 "\u65e5\u5fd7\u5df2\u6e05\u7a7a\u3002": "Log cleared.",
 "\u6e05\u7a7a\u65e5\u5fd7": "Clear log",
 "\u5c1a\u672a\u5f00\u59cb\u66f4\u65b0\u3002": "No update has started.",
 "\u6b63\u5728\u91cd\u65b0\u8bfb\u53d6\u66f4\u65b0\u72b6\u6001\u2026": "Reading update status again...",
 "\u786e\u8ba4\u542f\u52a8\u5728\u7ebf\u66f4\u65b0\u68c0\u67e5\uff1f": "Check for online updates?",
 "1% \u00b7 \u6b63\u5728\u542f\u52a8\u5728\u7ebf\u66f4\u65b0\u4efb\u52a1\u2026": "1% \u00b7 Starting online update...",
 "\u5728\u7ebf\u66f4\u65b0": "Online update",
 "\u4e0a\u4f20\u6587\u4ef6\u4e0d\u80fd\u8d85\u8fc7 64 MiB\u3002": "The uploaded file must not exceed 64 MiB.",
 "\u4e0a\u4f20 frpc \u6216 tar.gz": "Upload frpc or tar.gz",
 "\u8bf7\u5148\u505c\u6b62 frpc\uff0c\u518d\u4fee\u6539\u4ee3\u7406\u987a\u5e8f\u3002": "Stop frpc before reordering proxies.",
 "TCP + UDP \u4ee3\u7406\u7684\u57fa\u7840\u540d\u79f0\u4e0d\u80fd\u8d85\u8fc7 60 \u4f4d\u3002": "The base name of a TCP + UDP proxy must not exceed 60 characters.",
 "\u4ee3\u7406\u548c\u8bbf\u95ee\u8005\u540d\u79f0\u4e0d\u80fd\u91cd\u590d\u3002": "Proxy and visitor names must be unique.",
 "\u4ee3\u7406\u8bbe\u7f6e": "Proxy settings",
 "\u65e5\u5fd7": "Logs",
 "\u66f4\u65b0\u5185\u6838": "Update core",
 "\u8ba4\u8bc1\u4fe1\u606f": "Authentication",
 "\u670d\u52a1\u5668\u5730\u5740": "Server address",
 "\u670d\u52a1\u5668\u7aef\u53e3": "Server port",
 "\u7528\u6237": "User",
 "\u4e0d\u80fd\u4e3a\u7a7a\u3001\u4e0d\u80fd\u5305\u542b\u63a7\u5236\u5b57\u7b26\u4e14\u4e0d\u80fd\u8d85\u8fc7 64 \u4f4d\u3002": "This field is required, must not contain control characters, and must not exceed 64 characters.",
 "\u8ba4\u8bc1\u65b9\u5f0f": "Authentication method",
 "metadatas.token\uff08\u7528\u6237\u72ec\u7acb\u5bc6\u94a5\uff09": "metadatas.token (per-user key)",
 "auth.token\uff08\u5168\u5c40 Token\uff09": "auth.token (global token)",
 "\u4e0d\u80fd\u4e3a\u7a7a\u4e14\u4e0d\u80fd\u5305\u542b\u63a7\u5236\u5b57\u7b26\u3002": "This field is required and must not contain control characters.",
 "\u542f\u7528 TLS": "Enable TLS",
 "\u767b\u5f55\u5931\u8d25\u9000\u51fa": "Exit on login failure",
 "\u65e5\u5fd7\u7b49\u7ea7": "Log level",
 "\u65e5\u5fd7\u4fdd\u7559\u5929\u6570": "Log retention (days)",
 "\u4fdd\u5b58\u8ba4\u8bc1\u4fe1\u606f": "Save authentication",
 "\u4ee3\u7406\u7ba1\u7406": "Proxies",
 "\u6dfb\u52a0\u4ee3\u7406": "Add proxy",
 "\u540d\u79f0": "Name",
 "\u7c7b\u578b": "Type",
 "\u672c\u5730\u5730\u5740": "Local address",
 "\u672c\u5730\u7aef\u53e3": "Local port",
 "\u8fdc\u7a0b\u7aef\u53e3": "Remote port",
 "\u81ea\u5b9a\u4e49\u57df\u540d": "Custom domains",
 "\u591a\u4e2a\u57df\u540d\u7528\u82f1\u6587\u9017\u53f7\u5206\u9694": "Separate multiple domains with commas",
 "\u81ea\u5b9a\u4e49\u57df\u540d\u548c\u5b50\u57df\u540d\u81f3\u5c11\u586b\u5199\u4e00\u9879\u3002": "Specify at least one custom domain or subdomain.",
 "\u57df\u540d\u4e0d\u80fd\u5305\u542b\u7a7a\u767d\u5b57\u7b26\u3002": "Domains must not contain whitespace.",
 "\u5b50\u57df\u540d": "Subdomain",
 "\u5b50\u57df\u540d\u4e0d\u80fd\u5305\u542b\u7a7a\u767d\u5b57\u7b26\u3002": "Subdomains must not contain whitespace.",
 "\u9884\u5171\u4eab\u5bc6\u94a5": "Shared secret",
 "\u9884\u5171\u4eab\u5bc6\u94a5\u4e0d\u80fd\u4e3a\u7a7a\u4e14\u4e0d\u80fd\u5305\u542b\u63a7\u5236\u5b57\u7b26\u3002": "The shared secret is required and must not contain control characters.",
 "\u5141\u8bb8\u7528\u6237": "Allowed users",
 "user1,user2 \u6216 *": "user1,user2 or *",
 "\u5141\u8bb8\u7528\u6237\u5e94\u4f7f\u7528\u82f1\u6587\u9017\u53f7\u5206\u9694\u4e14\u4e0d\u80fd\u5305\u542b\u7a7a\u683c\u3002": "Separate allowed users with commas and do not use spaces.",
 "\u591a\u8def\u590d\u7528\u5668": "Multiplexer",
 "\u52a0\u5bc6": "Encryption",
 "\u538b\u7f29": "Compression",
 "\u79c1\u6709\u534f\u8bae\u8bbf\u95ee\u8005": "Private protocol visitors",
 "\u6dfb\u52a0\u8bbf\u95ee\u8005": "Add visitor",
 "\u672a\u547d\u540d\u8bbf\u95ee\u8005": "Unnamed visitor",
 "\u670d\u52a1\u7aef\u4ee3\u7406\u540d\u79f0": "Server proxy name",
 "\u670d\u52a1\u7aef\u7528\u6237": "Server user",
 "\u670d\u52a1\u7aef\u7528\u6237\u4e0d\u80fd\u5305\u542b\u7a7a\u767d\u5b57\u7b26\u3002": "The server user must not contain whitespace.",
 "\u7ed1\u5b9a\u5730\u5740": "Bind address",
 "\u7ed1\u5b9a\u7aef\u53e3": "Bind port",
 "\u4fdd\u6301 XTCP \u96a7\u9053": "Keep XTCP tunnel open",
 "\u542f\u7528": "Enable",
 "frp \u5ba2\u6237\u7aef": "FRP client",
 "\u65e0\u6cd5\u521b\u5efa\u5185\u5b58\u5de5\u4f5c\u76ee\u5f55": "Failed to create temporary work directory",
 "\u4e0d\u652f\u6301\u7684\u670d\u52a1\u64cd\u4f5c": "Unsupported service action",
 "frpc \u542f\u52a8\u5931\u8d25\uff0c\u8bf7\u67e5\u770b\u7cfb\u7edf\u65e5\u5fd7": "frpc failed to start. Check the system log.",
 "frpc \u6b63\u5728\u8fd0\u884c\uff0c\u8bf7\u5148\u505c\u6b62\u670d\u52a1\u518d\u4fdd\u5b58\u914d\u7f6e": "frpc is running. Stop the service before saving configuration",
 "\u8ba4\u8bc1\u4fe1\u606f\u4e3a\u7a7a": "Authentication is empty",
 "\u8ba4\u8bc1\u4fe1\u606f\u8fc7\u5927": "Authentication data is too large",
 "\u8ba4\u8bc1\u4fe1\u606f\u683c\u5f0f\u65e0\u6548": "Invalid authentication data",
 "\u670d\u52a1\u5668\u5730\u5740\u4e0d\u80fd\u5305\u542b\u7a7a\u767d\u5b57\u7b26": "Server address must not contain whitespace",
 "\u670d\u52a1\u5668\u7aef\u53e3\u8d85\u51fa\u8303\u56f4": "Server port is out of range",
 "\u65e5\u5fd7\u4fdd\u7559\u5929\u6570\u8d85\u51fa\u8303\u56f4": "Log retention is out of range",
 "\u7528\u6237\u4e0d\u80fd\u8d85\u8fc7 64 \u4f4d": "User must not exceed 64 characters",
 "\u8ba4\u8bc1\u65b9\u5f0f\u65e0\u6548": "Invalid authentication method",
 "\u5f00\u5173\u503c\u65e0\u6548": "Invalid boolean value",
 "\u65e5\u5fd7\u7b49\u7ea7\u65e0\u6548": "Invalid log level",
 "\u8bfb\u53d6\u8ba4\u8bc1\u4fe1\u606f\u5931\u8d25": "Failed to read authentication data",
 "\u5199\u5165\u8ba4\u8bc1\u4fe1\u606f\u5931\u8d25": "Failed to write authentication data",
 "\u5199\u5165\u542f\u7528\u72b6\u6001\u5931\u8d25": "Failed to set the enabled flag",
 "\u4fdd\u5b58\u8ba4\u8bc1\u4fe1\u606f\u5931\u8d25": "Failed to save authentication",
 "\u8ba4\u8bc1\u4fe1\u606f\u5df2\u4fdd\u5b58\uff0c\u53ef\u624b\u52a8\u542f\u52a8\u670d\u52a1\u3002": "Authentication saved. You can start the service manually.",
 "\u4e0d\u652f\u6301\u7684\u65e5\u5fd7\u7c7b\u578b": "Unsupported log type",
 "\u6e05\u7a7a\u65e5\u5fd7\u5931\u8d25": "Failed to clear log",
 "\u7f3a\u5c11\u670d\u52a1\u64cd\u4f5c": "Missing service action",
 "\u53c2\u6570\u65e0\u6548": "Invalid arguments",
 "\u751f\u6210\u8fd0\u884c\u914d\u7f6e\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u8ba4\u8bc1\u4fe1\u606f\u548c\u4ee3\u7406\u8bbe\u7f6e": "Failed to generate runtime configuration. Check authentication and proxy settings.",
 "\u7f3a\u5c11\u65e5\u5fd7\u7c7b\u578b": "Missing log type",
 "\u5df2\u6709\u66f4\u65b0\u4efb\u52a1\u6b63\u5728\u6267\u884c\u3002": "An update is already in progress.",
 "\u6b63\u5728\u542f\u52a8\u5728\u7ebf\u66f4\u65b0\u4efb\u52a1\u2026": "Starting online update...",
 "\u65e0\u6cd5\u542f\u52a8\u5728\u7ebf\u66f4\u65b0\u4efb\u52a1": "Failed to start online update",
 "\u5728\u7ebf\u66f4\u65b0\u4efb\u52a1\u5df2\u542f\u52a8": "Online update started",
 "\u4e0a\u4f20\u6587\u4ef6\u4e3a\u7a7a": "The uploaded file is empty",
 "\u6b63\u5728\u542f\u52a8\u672c\u5730\u66f4\u65b0\u4efb\u52a1\u2026": "Starting local update...",
 "\u65e0\u6cd5\u542f\u52a8\u672c\u5730\u66f4\u65b0\u4efb\u52a1": "Failed to start local update",
 "\u4e0a\u4f20\u6587\u4ef6\u5df2\u63a5\u6536\uff0c\u66f4\u65b0\u4efb\u52a1\u5df2\u542f\u52a8": "Upload received. Update started.",
 "\u66f4\u65b0\u4efb\u52a1\u6b63\u5728\u8fd0\u884c\u2026": "Update is in progress...",
 "\u7528\u6cd5\uff1afrpc-ui": "Usage: frpc-ui",
 "\u6b63\u5728\u6821\u9a8c\u5019\u9009 frpc\u2026": "Verifying candidate frpc...",
 "\u65e0\u6cd5\u8bbe\u7f6e\u5019\u9009\u6587\u4ef6\u6267\u884c\u6743\u9650": "Failed to make the candidate executable",
 "\u5019\u9009\u6587\u4ef6\u4e0d\u662f\u6709\u6548\u7684 frpc": "The candidate is not a valid frpc executable",
 "\u6b63\u5728\u505c\u6b62 frpc \u670d\u52a1\u2026": "Stopping frpc service...",
 "\u505c\u6b62 frpc \u5931\u8d25": "Failed to stop frpc",
 "\u5907\u4efd\u5f53\u524d frpc \u5931\u8d25": "Failed to back up current frpc",
 "\u5199\u5165\u65b0\u7248 frpc \u5931\u8d25\uff0c\u5df2\u5c1d\u8bd5\u6062\u590d\u65e7\u7248\u672c": "Failed to write new frpc. Attempted to restore the previous version.",
 "\u6b63\u5728\u542f\u52a8\u65b0\u7248 frpc\u2026": "Starting new frpc...",
 "\u65b0\u7248 frpc \u542f\u52a8\u5931\u8d25\uff0c\u6b63\u5728\u56de\u6eda\u3002": "New frpc failed to start. Rolling back.",
 "\u542f\u52a8\u5931\u8d25\u4e14\u6ca1\u6709\u53ef\u7528\u5907\u4efd": "Startup failed and no backup is available",
 "\u65b0\u7248 frpc \u542f\u52a8\u5931\u8d25\uff0c\u5df2\u6062\u590d\u65e7\u7248\u672c": "New frpc failed to start. Previous version restored.",
 "\u65e0\u6cd5\u521b\u5efa\u5185\u5b58\u66f4\u65b0\u76ee\u5f55": "Failed to create temporary update directory",
 "\u66f4\u65b0\u4efb\u52a1\u5df2\u542f\u52a8\u3002": "Update started.",
 "\u5f00\u59cb\u68c0\u67e5 frpc \u5728\u7ebf\u66f4\u65b0\u3002": "Checking for frpc online updates.",
 "\u6b63\u5728\u67e5\u8be2 GitHub \u6700\u65b0\u7248\u672c\u2026": "Checking the latest GitHub release...",
 "\u67e5\u8be2 GitHub \u6700\u65b0\u7248\u672c\u5931\u8d25": "Failed to query the latest GitHub release",
 "\u6b63\u5728\u89e3\u6790\u6700\u65b0\u7248\u672c\u4fe1\u606f\u2026": "Parsing release information...",
 "\u65e0\u6cd5\u89e3\u6790\u6700\u65b0\u7248\u53f7": "Failed to parse the latest version",
 "\u5f53\u524d CPU \u67b6\u6784\u4e0d\u53d7\u5728\u7ebf\u66f4\u65b0\u652f\u6301": "Online update does not support this CPU architecture",
 "\u4e0b\u8f7d\u6700\u65b0\u7248\u5931\u8d25": "Failed to download the latest release",
 "\u4e0b\u8f7d\u5b8c\u6210\uff0c\u6b63\u5728\u89e3\u538b\u2026": "Download complete. Extracting...",
 "\u4e0b\u8f7d\u5305\u4e2d\u672a\u627e\u5230\u6709\u6548 frpc": "No valid frpc executable found in the download",
 "\u7f3a\u5c11\u4e0a\u4f20\u6587\u4ef6": "Missing upload",
 "\u4e0a\u4f20\u6587\u4ef6\u8def\u5f84\u65e0\u6548": "Invalid upload path",
 "\u5f00\u59cb\u68c0\u67e5\u672c\u5730\u4e0a\u4f20\u7684 frpc\u3002": "Checking uploaded frpc.",
 "\u6b63\u5728\u8bfb\u53d6\u4e0a\u4f20\u6587\u4ef6\u2026": "Reading upload...",
 "\u8bfb\u53d6\u4e0a\u4f20\u6587\u4ef6\u5931\u8d25": "Failed to read upload",
 "\u4e0d\u652f\u6301\u7684\u66f4\u65b0\u65b9\u5f0f": "Unsupported update method"
};
var legacyPatterns = [
 [
  "^frpc\\ (.+)\\ \u6267\u884c\u5931\u8d25$",
  "frpc %s failed"
 ],
 [
  "^\u8ba4\u8bc1\u5b57\u6bb5\u4e0d\u80fd\u4e3a\u7a7a\uff1a(.+)$",
  "Authentication field is required: %s"
 ],
 [
  "^\u8ba4\u8bc1\u5b57\u6bb5\u5305\u542b\u63a7\u5236\u5b57\u7b26\uff1a(.+)$",
  "Authentication field contains control characters: %s"
 ],
 [
  "^\u6570\u503c\u5b57\u6bb5\u65e0\u6548\uff1a(.+)$",
  "Invalid numeric field: %s"
 ],
 [
  "^\u6570\u503c\u5b57\u6bb5\u8d85\u51fa\u8303\u56f4\uff1a(.+)$",
  "Numeric field is out of range: %s"
 ],
 [
  "^\u66f4\u65b0\u5931\u8d25\uff1a(.+)$",
  "Update failed: %s"
 ],
 [
  "^\u5f53\u524d\\ frpc\\ (.+)\\ \u4e0d\u4f4e\u4e8e\u5f85\u5b89\u88c5\u7248\u672c\\ (.+)\uff0c\u65e0\u9700\u66f4\u65b0\u3002$",
  "Current frpc %s is not older than candidate %s. No update needed."
 ],
 [
  "^\u5f53\u524d\\ frpc\\ (.+)\\ \u5df2\u662f\u6700\u65b0\u7248\u672c\u3002$",
  "Current frpc %s is up to date."
 ],
 [
  "^\u6b63\u5728\u5b89\u88c5\\ frpc\\ (.+)\u2026$",
  "Installing frpc %s..."
 ],
 [
  "^frpc\\ \u5df2\u4ece\\ (.+)\\ \u66f4\u65b0\u5230\\ (.+)\u3002$",
  "frpc updated from %s to %s."
 ],
 [
  "^frpc\\ \u5df2\u66f4\u65b0\u5230\\ (.+)\u3002$",
  "frpc updated to %s."
 ],
 [
  "^\u5f53\u524d\\ frpc\\ (.+)\\ \u4e0d\u4f4e\u4e8e\u5b98\u65b9\u6700\u65b0\u7248\\ (.+)\uff0c\u65e0\u9700\u66f4\u65b0\u3002$",
  "Current frpc %s is not older than the latest official release %s. No update needed."
 ],
 [
  "^\u5f53\u524d\\ frpc\\ (.+)\\ \u5df2\u662f\u5b98\u65b9\u6700\u65b0\u7248\u3002$",
  "Current frpc %s is the latest official release."
 ],
 [
  "^\u53d1\u73b0\u65b0\u7248\\ frpc\\ (.+)\uff0c\u6b63\u5728\u786e\u8ba4\u7cfb\u7edf\u67b6\u6784\u2026$",
  "Found frpc %s. Detecting system architecture..."
 ],
 [
  "^\u6b63\u5728\u4e0b\u8f7d\\ frpc\\ (.+)\u2026$",
  "Downloading frpc %s..."
 ]
];
function normalizeLegacy(text, depth) {
 if ((depth || 0) > 8) return text;
 if (Object.prototype.hasOwnProperty.call(legacyMessages, text)) return legacyMessages[text];
 for (var i = 0; i < legacyPatterns.length; i++) {
  var match = new RegExp(legacyPatterns[i][0]).exec(text);
  if (!match) continue;
  var argument = 0;
  return legacyPatterns[i][1].replace(/%s/g, function() { return normalizeLegacy(match[++argument], (depth || 0) + 1); });
 }
 return text;
}
function translate(message, depth) {
 var text = normalizeLegacy(String(message == null ? '' : message));
 var direct = _(text, 'frpc-own');
 if (direct !== text || (depth || 0) > 8) return direct;
 for (var i = 0; i < patterns.length; i++) {
  var match = new RegExp(patterns[i][0]).exec(text);
  if (!match) continue;
  var template = _(patterns[i][1], 'frpc-own');
  if (template === patterns[i][1]) return text;
  var argument = 0;
  return template.replace(/%s/g, function() { return translate(match[++argument], (depth || 0) + 1); });
 }
 return text;
}
function logText(text) {
 return String(text).split('\n').map(function(line) {
  var match = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} )(.*)$/.exec(line);
  return match ? match[1] + translate(match[2]) : translate(line);
 }).join('\n');
}
return baseclass.extend({ translate: translate, logText: logText });
