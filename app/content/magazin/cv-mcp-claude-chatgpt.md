---
title: "Let Claude edit your CV directly: the MCP connection explained"
slug: "cv-mcp-claude-chatgpt"
description: "How to connect Claude or another AI assistant to your CV via MCP, which assistants support it in November 2026, and what data the AI sees."
category: "ki"
lang: en
updated: 2026-11-17
published: 2026-11-17
translationKey: "lebenslauf-mcp-ki-verbinden"
---

With MCP, the Model Context Protocol, your AI assistant reads and edits your CV in the CV tool directly. You ask Claude to tailor your CV to a job ad, and it reads the current version, writes the changes back and the preview updates. There is no copying and pasting. You connect once by entering one web address and confirming in your browser. Before every change the server saves the previous state, so you can go back. This article explains how it works, which assistants support it and what the AI gets to see.

## What MCP is

MCP is an open standard that lets AI assistants use outside tools. An MCP server offers a set of actions, and the assistant decides when to call them. The CV tool's server offers actions such as these:

- list your CVs and read one as Markdown,
- save a revised CV or cover letter from Markdown,
- read and change design settings, such as the template or the accent colour,
- set or remove the application photo,
- create a new CV or rename one.

The assistant works with the same Markdown format as the copy-and-paste bridge in the editor: headings for each section, a line per field, bullets for each job. Content can be in English, German, French or Spanish.

## Which assistants support it (November 2026)

Support for your own MCP servers differs between assistants and plans and changes often. As of 17.11.2026:

| Assistant | Own MCP servers | Notes |
|---|---|---|
| Claude (claude.ai, desktop app) | Yes, on all plans | Free plan: one custom connector. Added on the web or desktop, then usable on mobile too. Tested with this CV tool. |
| ChatGPT | Developer mode, paid plans only | OpenAI's pages are not consistent on which paid plans. Write actions need confirmation. Not tested with this CV tool. |
| Mistral Vibe (formerly Le Chat) | Yes | Custom MCP connectors with OAuth. Not tested. |
| Perplexity | Yes | Custom remote connectors; the help page does not say which plans. Not tested. |
| Gemini | Only in the US | Custom connected apps for personal accounts in English, US only. |
| VS Code and other developer tools | Yes | Add the address as an HTTP server. |

The table follows each provider's documentation. "Not tested" means we have not checked that assistant with this server ourselves. Anything that supports remote MCP servers with OAuth should work.

## How to connect Claude

1. In Claude on the web or the desktop app, open Customize, then Connectors, click "+ Add" and choose "Add custom connector". On a Team or Enterprise plan, an owner adds the connector under Organization settings first.
2. Enter the address of your instance's MCP server, for example `https://<your-instance>/mcp`.
3. Claude opens a browser window. Sign in to the CV tool and confirm the access.
4. In a chat, ask for example: "Read my CV and tailor it to this job ad: …"

There is no key to copy. Sign-in runs over OAuth, and in the CV tool under Settings and Connected apps you see every access you granted and can end each one.

## What the AI sees and where your data goes

Your CV is stored on the server of the instance you use. When you ask an assistant to work on it, the assistant reads the CV through MCP, and that text then goes to the AI provider, for example Anthropic for Claude or OpenAI for ChatGPT. Their servers are mostly in the US, and their own privacy terms apply. The CV tool does not send anything to an AI provider by itself; it happens only when you start it in your assistant.

So decide what you let the AI read. Contact details and your photo are not needed to improve the wording. If you prefer, work on a copy without them, or use the Markdown bridge and paste only the parts you want revised.

## Safety net: versions

Before an assistant changes content or design through MCP, the server stores the previous state as a version. You can restore any of the last 25 versions in the editor. Still read what changed: an AI can make a sentence sound better and get a fact wrong. Our article on [writing a CV with AI without making things up](/magazin/lebenslauf-mit-ki-schreiben-ohne-erfindungen/) (in German) has a method for checking.

## What you need

MCP needs an account, because the assistant has to know whose CV it is working on. If the instance offers the optional Application Pass, the connection is part of it. Without an account you can do the same by hand: export your CV as Markdown, paste it into any chat and import the result; the tool shows you what changed before anything is applied.

The CV tool is open source. If you run your own instance, the MCP server is included, at `https://<your-instance>/mcp`. [Open the CV tool](/en/).

## Frequently asked questions

### Can ChatGPT edit my CV via MCP?

According to OpenAI's documentation, ChatGPT supports custom MCP servers in developer mode on paid plans, and write actions need your confirmation. We have not tested ChatGPT with this CV tool. Claude is tested, and custom connectors are available on all Claude plans.

### Does the free Claude plan support MCP connectors?

Yes. On the free plan you can add one custom connector, according to Anthropic's help centre (November 2026).

### Is my CV sent to the AI provider?

Only the parts the assistant reads, and only when you ask it to work on your CV. That text is processed by the AI provider under its own privacy terms. The CV itself stays stored on the server of the instance.

### Can the AI break my CV?

It can make unwanted changes, but not irreversibly. Before every change via MCP the server saves a version, and you can restore any of the last 25.

## Sources

All sources accessed on 17.11.2026.

- Model Context Protocol: introduction. https://modelcontextprotocol.io/
- Anthropic Help Center: "Get started with custom connectors using remote MCP". https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- OpenAI: developer mode and MCP connectors. https://developers.openai.com/api/docs/guides/developer-mode.md
- OpenAI Help Center: "Developer mode, apps and full MCP connectors in ChatGPT". https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt
- Mistral: MCP connectors in Vibe (formerly Le Chat). https://docs.mistral.ai/le-chat/knowledge-integrations/connectors/mcp-connectors
- Perplexity Help Center: "Adding custom remote connectors". https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors
- Google Gemini Help: custom connected apps. https://support.google.com/gemini/answer/17209137?hl=en
- Visual Studio Code: MCP servers. https://code.visualstudio.com/docs/copilot/customization/mcp-servers
