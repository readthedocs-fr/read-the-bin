import { GuildChannel, Message, MessageEmbed } from "discord.js";
import fetch from "node-fetch";
import { extname } from "path";

import { Client, Event } from "../../classes";
import { createBin, processContent, sendBinEmbed } from "../../helpers";
import { extensions } from "../../misc/extensions";

const MAX_LINES = parseInt(process.env.MAX_LINES!, 10);

const noop = (): undefined => undefined;

export default class MessageEvent extends Event {
	public constructor(client: Client) {
		super("message", client);
	}

	public async listener(message: Message): Promise<void> {
		const categories = process.env.CATEGORIES!.split(",");

		if (
			!(message.channel instanceof GuildChannel) ||
			message.author.bot ||
			!categories.includes(message.channel.parentID!)
		) {
			return;
		}

		if (message.attachments.size > 0) {
			const file = message.attachments.first(); // only take first attachment as, normally, users cannot send more than one attachment

			if (!file?.name) {
				return;
			}

			const fileExtension = extname(file.name).substring(1);
			const language = fileExtension || "txt";

			if (language !== "txt" && !extensions.has(language) && !message.content.trim()) {
				return;
			}

			// prettier-ignore
			// There are conflicts between Prettier and ESLint
			const code =
				language === "txt" || extensions.has(language)
					? await fetch(file.url)
						.then((res) => res.text())
						.catch(noop)
					: undefined;

			const processed =
				message.content.split("\n", MAX_LINES).length === MAX_LINES
					? await processContent(message.content)
					: undefined;
			const content = code?.trim() ? await createBin(code, language).catch((e: Error) => e) : undefined;

			if (!content && !processed) {
				return;
			}

			if (content instanceof Error) {
				// eslint-disable-next-line max-len
				const botMessage = `${content}\n\nCependant, bien que votre message n'ait pas été effacé, il a été jugé trop "lourd" pour être lu (code trop long, fichier texte présent). Nous vous conseillons l'usage d'un service de bin pour les gros morceaux de code, tel ${process.env.BIN_URL!.slice(
					0,
					-4,
				)}`;

				await message.channel.send(botMessage).catch(noop);

				return;
			}

			await sendBinEmbed(
				message,
				processed || message.content.trim(),
				content ? (embed): MessageEmbed => embed.addField("📁 Pièce jointe", content) : undefined,
				!code ? file : undefined,
			);

			return;
		}

		const lines = message.content.split("\n", MAX_LINES).length;

		if (lines < MAX_LINES) {
			return;
		}

		const processed = await processContent(message.content).catch(noop);

		if (processed) {
			sendBinEmbed(message, processed).catch(noop);
		}
	}
}
