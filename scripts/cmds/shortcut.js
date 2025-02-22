const { getExtFromUrl, drive, getStreamFromURL } = global.utils;

module.exports = {
	config: {
		name: 'shortcut',
		aliases: ['short'],
		version: '1.5',
		author: 'NTKhang',
		countDown: 5,
		role: 0,
		shortDescription: {
			vi: 'Thêm một phím tắt cho bạn',
			en: 'Add a shortcut for you'
		},
		longDescription: {
			vi: 'Thêm một phím tắt cho tin nhắn trong nhóm chat của bạn',
			en: 'Add a shortcut for your message in group chat'
		},
		category: 'custom',
		guide: {
			body: {
				vi: '   {pn} add <word> => <content>: thêm một phím tắt cho bạn (có thể gửi kèm hoặc phản hồi một tin nhắn có file để thêm tệp đính kèm)'
					+ '\n   Ví dụ:\n    {pn} add hi => Xin chào mọi người'
					+ '\n'
					+ '\n   {pn} del <word>: xóa một phím tắt'
					+ '\n   Ví dụ:\n    {pn} del hi'
					+ '\n'
					+ '\n   {pn} reomve: xóa bỏ tất cả các phím tắt trong nhóm chat của bạn'
					+ '\n'
					+ '\n   {pn} list: xem danh sách các phím tắt của bạn',
				en: '   {pn} add <word> => <content>: add a shortcut for you (you can send or reply a message with file to add attachment)'
					+ '\n   Example:\n    {pn} add hi => Hello everyone'
					+ '\n'
					+ '\n   {pn} del <word>: delete a shortcut'
					+ '\n   Example:\n    {pn} del hi'
					+ '\n'
					+ '\n   {pn} reomve: remove all shortcuts in your group chat'
					+ '\n'
					+ '\n   {pn} list: view your shortcuts list'
			}
		}
	},

	langs: {
		vi: {
			missingContent: 'Vui lòng nhập nội dung tin nhắn',
			shortcutExists: 'Shortcut này đã tồn tại',
			added: 'Đã thêm shortcut %1 => %2',
			addedAttachment: ' với %1 tệp đính kèm',
			missingKey: 'Vui lòng nhập từ khóa của shortcut muốn xóa',
			notFound: 'Không tìm thấy shortcut nào cho từ khóa %1 trong nhóm chat của bạn',
			onlyAdmin: 'Chỉ quản trị viên mới có thể xóa shortcut của người khác',
			deleted: 'Đã xóa shortcut %1',
			empty: 'Nhóm chat của bạn chưa thêm shortcut nào',
			message: 'Tin nhắn',
			attachment: 'Tệp đính kèm',
			list: 'Danh sách các shortcut của bạn',
			onlyAdminRemoveAll: 'Chỉ quản trị viên mới có thể xóa tất cả các shortcut trong nhóm chat',
			confirmRemoveAll: 'Bạn có chắc muốn xóa tất cả các shortcut trong nhóm chat này không? (thả cảm xúc vào tin nhắn này để xác nhận)',
			removedAll: 'Đã xóa tất cả các shortcut trong nhóm chat của bạn'
		},
		en: {
			missingContent: 'Please enter the message content',
			shortcutExists: 'This shortcut already exists',
			added: 'Added shortcut %1 => %2',
			addedAttachment: ' with %1 attachment(s)',
			missingKey: 'Please enter the keyword of the shortcut you want to delete',
			notFound: 'No shortcut found for keyword %1 in your group chat',
			onlyAdmin: 'Only administrators can delete other people\'s shortcuts',
			deleted: 'Deleted shortcut %1',
			empty: 'Your group chat has not added any shortcuts',
			message: 'Message',
			attachment: 'Attachment',
			list: 'Your shortcuts list',
			onlyAdminRemoveAll: 'Only administrators can remove all shortcuts in the group chat',
			confirmRemoveAll: 'Are you sure you want to remove all shortcuts in this group chat? (react to this message to confirm)',
			removedAll: 'Removed all shortcuts in your group chat'
		}
	},

	onStart: async function ({ args, threadsData, message, event, role, usersData, getLang, commandName }) {
		const { threadID, senderID, body } = event;
		const dataShortcut = await threadsData.get(threadID, 'data.shortcut', []);

		switch (args[0]) {
			case 'add': {
				const [key, content] = body.split(' ').slice(2).join(' ').split('=>');
				const attachments = [...event.attachments, ...(event.messageReply ? event.messageReply.attachments : [])];
				if (!key || !content && attachments.length === 0)
					return message.reply(getLang('missingContent'));
				if (dataShortcut.some(item => item.key == key))
					return message.reply(getLang('shortcutExists'));
				let attachmentIDs = [];
				if (attachments.length > 0)
					attachmentIDs = attachments.map(attachment => new Promise(async (resolve) => {
						const ext = getExtFromUrl(attachment.url);
						const fileName = `${Date.now()}.${ext}`;
						const infoFile = await drive.uploadFile(`shortcut_${threadID}_${senderID}_${fileName}`, await getStreamFromURL(attachment.url));
						resolve(infoFile.id);
					}));
				dataShortcut.push({
					key: key.trim().toLowerCase(),
					content,
					attachments: await Promise.all(attachmentIDs),
					author: senderID
				});
				await threadsData.set(threadID, dataShortcut, 'data.shortcut');
				let msg = getLang('added', key, content) + "\n";
				if (attachmentIDs.length > 0)
					msg += getLang('addedAttachment', attachmentIDs.length);
				message.reply(msg);
				break;
			}
			case 'del':
			case 'delete': {
				const key = args.slice(1).join(' ');
				if (!key)
					return message.reply(getLang('missingKey'));
				const index = dataShortcut.findIndex(x => x.key === key);
				if (index === -1)
					return message.reply(getLang('notFound', key));
				if (senderID != dataShortcut[index].author && role < 1)
					return message.reply(getLang('onlyAdmin'));
				dataShortcut.splice(index, 1);
				await threadsData.set(threadID, dataShortcut, 'data.shortcut');
				message.reply(getLang('deleted', key));
				break;
			}
			case 'list': {
				if (dataShortcut.length === 0)
					return message.reply(getLang('empty'));
				const list = (await Promise.all(dataShortcut.map(async (x, index) => `[${index + 1}] ${x.key} => ${x.content ? 1 : 0} ${getLang("message")}, ${x.attachments.length} ${getLang('attachment')} (${await usersData.getName(x.author)})`))).join('\n');
				message.reply(getLang('list') + '\n' + list);
				break;
			}
			case 'remove':
			case '-rm':
			case 'rm': {
				if (threadID != senderID && role < 1)
					return message.reply(getLang('onlyAdminRemoveAll'));
				message.reply(getLang('confirmRemoveAll'), (err, info) => {
					if (err)
						return;
					global.GoatBot.onReaction.set(info.messageID, {
						commandName,
						messageID: info.messageID,
						author: senderID
					});
				});
				break;
			}
			default:
				message.SyntaxError();
				break;
		}
	},

	onReaction: async function ({ event, message, threadsData, getLang, Reaction }) {
		const { author } = Reaction;
		const { threadID, userID } = event;
		if (author != userID)
			return;
		await threadsData.set(threadID, [], "data.shortcut");
		return message.reply(getLang('removedAll'));
	},

	onChat: async ({ threadsData, message, event }) => {
		const { threadID } = event;
		const body = (event.body || '').toLowerCase();
		const dataShortcut = await threadsData.get(threadID, 'data.shortcut', []);
		const findShortcut = dataShortcut.find(x => x.key === body);
		let attachments = [];
		if (findShortcut) {
			if (findShortcut.attachments.length > 0) {
				for (const id of findShortcut.attachments)
					attachments.push(drive.getFile(id, 'stream', true));
				attachments = await Promise.all(attachments);
			}

			message.reply({
				body: findShortcut.content,
				attachment: attachments
			});
		}
	}
};