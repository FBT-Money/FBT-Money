const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

const TARGET_CATEGORY_ID = '1536915195115343872';
const LOG_CHANNEL_ID = '1535134155011268741';
const OWNER_ID = '1040439110486016104';
const TARGET_ROLE_ID = '1534423663028207668';

const THUMBNAIL_URL = 'https://i.postimg.cc/7LPvkvdS/ezgif-com-crop.gif';
const BANNER_URL = 'https://i.postimg.cc/gJ518xJy/ezgif-com-optimize-(4)-(1).gif';
const STORE_NAME = '🛒・𝐅𝐁𝐓-𝐒𝐭𝐨𝐫𝐞';

const ALLOWED_ROLE_IDS = [
    '1534423663028207669',
    '1534423663028207668',
    '1534423662579683445'
];

const userBalances = new Map();
const userDailyCooldown = new Map();
const userDailyCount = new Map();    
const userProductCount = new Map();   
const tempProductData = new Map();

client.once('ready', async () => {
    console.log(`Bot is online as ${client.user.tag}!`);

    const commands = [
        new SlashCommandBuilder().setName('add').setDescription('إضافة رصيد للمستخدم').addUserOption(o => o.setName('user').setDescription('المستخدم').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('المبلغ').setRequired(true)),
        new SlashCommandBuilder().setName('remove').setDescription('سحب رصيد من المستخدم').addUserOption(o => o.setName('user').setDescription('المستخدم').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('المبلغ').setRequired(true)),
        new SlashCommandBuilder().setName('reset').setDescription('تصفير رصيد المستخدم').addUserOption(o => o.setName('user').setDescription('المستخدم').setRequired(true)),
        
        new SlashCommandBuilder().setName('money').setDescription('معرفة الرصيد').addUserOption(o => o.setName('user').setDescription('المستخدم').setRequired(false)),
        new SlashCommandBuilder().setName('give').setDescription('تحويل رصيد (يخصم 2% ضريبة)').addUserOption(o => o.setName('user').setDescription('المستخدم').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('المبلغ').setRequired(true)),
        new SlashCommandBuilder().setName('pay').setDescription('دفع أو تحويل رصيد سريع (يخصم 2% ضريبة)').addUserOption(o => o.setName('user').setDescription('المستخدم').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('المبلغ').setRequired(true)),
        new SlashCommandBuilder().setName('daily').setDescription('استلام الجائزة اليومية'),
        new SlashCommandBuilder().setName('leaderboard').setDescription('لوحة المتصدرين'),
        new SlashCommandBuilder().setName('profile').setDescription('عرض ملفك الشخصي وإحصائياتك في المتجر')
    ];

    const rest = new REST({ version: '10' }).setToken('MTUzNjkxNTkzMzUwNjA0ODE1Mg.GL-HaJ.N0t6_lhDMYybVr5s5iBpB-fTtxjktxAa0LkxQE');
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Commands registered.');
    } catch (e) {
        console.error(e);
    }
});

function hasPermission(member) {
    if (!member) return false;
    if (member.id === OWNER_ID) return true;
    return member.roles.cache.some(r => ALLOWED_ROLE_IDS.includes(r.id));
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.channel.parentId !== TARGET_CATEGORY_ID) return;
    const content = message.content ? message.content.trim() : '';
    if (content !== 'تسجيل') return;

    try {
        await message.delete();
    } catch (e) {}

    const messages = await message.channel.messages.fetch({ limit: 10 }).catch(() => null);
    if (messages) {
        const botAlreadySent = messages.some(m => m.author.id === client.user.id && m.components.length > 0);
        if (botAlreadySent) return;
    }

    const embed = new EmbedBuilder()
        .setTitle(STORE_NAME)
        .setDescription('# 🛒 تريد عرض منتج؟\n\n# [ 1 ] ◄ نعم\n# [ 2 ] ◄ لا')
        .setThumbnail(THUMBNAIL_URL)
        .setImage(BANNER_URL)
        .setColor(0x010101);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('yes_product').setLabel('1 - نعم').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('no_product').setLabel('2 - لا').setStyle(ButtonStyle.Secondary)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options, member, user } = interaction;

        if (['add', 'remove', 'reset'].includes(commandName)) {
            if (!hasPermission(member)) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإدارة فقط.', ephemeral: true });
            }
            const targetUser = options.getUser('user');
            const amount = options.getInteger('amount');
            if (commandName === 'add') {
                userBalances.set(targetUser.id, (userBalances.get(targetUser.id) || 0) + amount);
                return interaction.reply({ content: `✅ تمت إضافة **${amount.toLocaleString()}** للمستخدم ${targetUser}.` });
            }
            if (commandName === 'remove') {
                userBalances.set(targetUser.id, Math.max(0, (userBalances.get(targetUser.id) || 0) - amount));
                return interaction.reply({ content: `✅ تم سحب المبلغ من ${targetUser}.` });
            }
            if (commandName === 'reset') {
                userBalances.set(targetUser.id, 0);
                return interaction.reply({ content: `🔄 تم تصفير حساب ${targetUser}.` });
            }
        }

        if (commandName === 'money') {
            const targetUser = options.getUser('user') || user;
            const balance = userBalances.get(targetUser.id) || 0;
            const embed = new EmbedBuilder()
                .setTitle(`${STORE_NAME} - الرصيد`)
                .setDescription(`# رصيد المستخدم ${targetUser} هو:\n# ${balance.toLocaleString()} FBT`)
                .setThumbnail(THUMBNAIL_URL)
                .setColor(0x010101);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'give' || commandName === 'pay') {
            const targetUser = options.getUser('user');
            const amount = options.getInteger('amount');

            if (targetUser.id === user.id) {
                return interaction.reply({ content: '❌ لا يمكنك التحويل لنفسك!', ephemeral: true });
            }
            if (amount <= 0) {
                return interaction.reply({ content: '❌ يجب أن يكون المبلغ أكبر من صفر!', ephemeral: true });
            }

            const senderBalance = userBalances.get(user.id) || 0;
            if (senderBalance < amount) {
                return interaction.reply({ content: `❌ رصيدك غير كافي للتحويل! رصيدك الحالي: **${senderBalance.toLocaleString()}**`, ephemeral: true });
            }

            const tax = Math.floor(amount * 0.02);
            const finalAmount = amount - tax;

            const receiverBalance = userBalances.get(targetUser.id) || 0;

            userBalances.set(user.id, senderBalance - amount);
            userBalances.set(targetUser.id, receiverBalance + finalAmount);

            const embed = new EmbedBuilder()
                .setTitle(`${STORE_NAME} - تحويل ناجح`)
                .setDescription(`# ✅ تم تحويل ${finalAmount.toLocaleString()} FBT بنجاح إلى ${targetUser}\n# 💸 تم خصم ضريبة 2% (${tax.toLocaleString()} FBT)`)
                .setThumbnail(THUMBNAIL_URL)
                .setImage(BANNER_URL)
                .setColor(0x010101);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'daily') {
            const userId = user.id;
            const now = Date.now();
            const cooldownTime = 24 * 60 * 60 * 1000;
            const lastDaily = userDailyCooldown.get(userId) || 0;

            if (now - lastDaily < cooldownTime) {
                const remainingTime = cooldownTime - (now - lastDaily);
                const hours = Math.floor(remainingTime / (1000 * 60 * 60));
                const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
                return interaction.reply({ content: `⏱️ لقد استخدمت الـ daily مسبقاً! يمكنك استخدامها بعد **${hours} ساعة و ${minutes} دقيقة**.`, ephemeral: true });
            }

            userDailyCooldown.set(userId, now);
            
            const currentCount = userDailyCount.get(userId) || 0;
            userDailyCount.set(userId, currentCount + 1);

            const currentBalance = userBalances.get(userId) || 0;
            const dailyAmount = 5000;
            userBalances.set(userId, currentBalance + dailyAmount);

            const embed = new EmbedBuilder()
                .setTitle(`${STORE_NAME} - المكافأة اليومية`)
                .setDescription(`# 🎁 تمت إضافة ${dailyAmount.toLocaleString()} FBT إلى رصيدك!\n# 📊 إجمالي مرات الاستلام: **${currentCount + 1}** مرة`)
                .setThumbnail(THUMBNAIL_URL)
                .setImage(BANNER_URL)
                .setColor(0x010101);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (commandName === 'leaderboard') {
            const sorted = Array.from(userBalances.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
            let desc = sorted.length ? '' : 'لا توجد أرصدة.';
            sorted.forEach(([id, bal], i) => desc += `# **${i + 1}.** <@${id}> ── **${bal.toLocaleString()}**\n`);
            return interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🏆 لوحة المتصدرين`).setDescription(desc).setThumbnail(THUMBNAIL_URL).setImage(BANNER_URL).setColor(0x010101)] });
        }

        if (commandName === 'profile') {
            const userId = user.id;
            const balance = userBalances.get(userId) || 0;
            const dailyCount = userDailyCount.get(userId) || 0;
            const productCount = userProductCount.get(userId) || 0;

            const now = Date.now();
            const cooldownTime = 24 * 60 * 60 * 1000;
            const lastDaily = userDailyCooldown.get(userId) || 0;
            const remainingTime = cooldownTime - (now - lastDaily);

            let dailyStatus = '✅ متاح الآن!';
            if (remainingTime > 0) {
                const hours = Math.floor(remainingTime / (1000 * 60 * 60));
                const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
                dailyStatus = `⏱️ متاح بعد: **${hours} ساعة و ${minutes} دقيقة**`;
            }

            const profileEmbed = new EmbedBuilder()
                .setTitle(`${STORE_NAME} - ملفك الشخصي`)
                .setDescription(`👤 **المستخدم:** ${user}\n\n💰 **الرصيد الحالي:** \`${balance.toLocaleString()} FBT\`\n\n🎁 **مرات استلام الـ Daily:** \`${dailyCount}\` مرة\n${dailyStatus}\n\n📦 **عدد المنتجات المنشورة:** \`${productCount}\` منتج`)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setImage(BANNER_URL)
                .setColor(0x010101);

            return interaction.reply({ embeds: [profileEmbed], ephemeral: true });
        }
    }

    if (!interaction.isButton() && !interaction.isModalSubmit()) return;

    // عند الضغط على "لا" أو "إلغاء"، يبدأ العد التنازلي في الشات ثانية بثانية ثم يتم إغلاق الروم
    if (interaction.customId === 'no_product' || interaction.customId === 'cancel_publish') {
        const embed = new EmbedBuilder()
            .setTitle(STORE_NAME)
            .setDescription('# ✨ شكراً لك!\n\n# سيتم إغلاق الروم خلال **5** ثوانٍ...')
            .setThumbnail(THUMBNAIL_URL)
            .setImage(BANNER_URL)
            .setColor(0x010101);

        await interaction.update({ embeds: [embed], components: [] });

        let timeLeft = 4;
        const countdownInterval = setInterval(async () => {
            if (timeLeft > 0) {
                const updateEmbed = new EmbedBuilder()
                    .setTitle(STORE_NAME)
                    .setDescription(`# ✨ شكراً لك!\n\n# سيتم إغلاق الروم خلال **${timeLeft}** ثوانٍ...`)
                    .setThumbnail(THUMBNAIL_URL)
                    .setImage(BANNER_URL)
                    .setColor(0x010101);

                try {
                    await interaction.editReply({ embeds: [updateEmbed] });
                } catch (e) {}
                timeLeft--;
            } else {
                clearInterval(countdownInterval);
                try {
                    if (interaction.channel && interaction.channel.deletable) {
                        await interaction.channel.delete();
                    }
                } catch (e) {
                    console.log('Could not delete channel:', e);
                }
            }
        }, 1000);

        return;
    }

    if (interaction.customId === 'yes_product') {
        const embed = new EmbedBuilder()
            .setTitle(STORE_NAME)
            .setDescription('# 💳 اختر طريقه الدفع\n\n# [ 1 ] ◄ FBT | Money\n\n# [ 2 ] ◄ كاش')
            .setThumbnail(THUMBNAIL_URL)
            .setImage(BANNER_URL)
            .setColor(0x010101);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('pay_fbt').setLabel('1 - FBT | Money').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('pay_cash').setLabel('2 - كاش').setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.customId === 'pay_fbt' || interaction.customId === 'pay_cash') {
        const paymentType = interaction.customId === 'pay_fbt' ? 'FBT' : 'Cash';
        
        const embed = new EmbedBuilder()
            .setTitle(STORE_NAME)
            .setDescription('# 💰 اختر السعر المناسب:\n\n# [ 1 ] ◄ 450,000,000 FBT\n\n# [ 2 ] ◄ 2 دولار')
            .setThumbnail(THUMBNAIL_URL)
            .setImage(BANNER_URL)
            .setColor(0x010101);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`price_1_${paymentType}`).setLabel('💎 450 مليون FBT').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`price_2_${paymentType}`).setLabel('💵 2 دولار').setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.customId.startsWith('price_')) {
        const [_, priceChoice, paymentType] = interaction.customId.split('_');

        if (paymentType === 'Cash') {
            const embed = new EmbedBuilder()
                .setTitle(STORE_NAME)
                .setDescription('# ✅ تم تسجيل طلبك بنجاح.\n\n# يرجى الانتظار، سيتم التواصل معك قريباً.')
                .setThumbnail(THUMBNAIL_URL)
                .setImage(BANNER_URL)
                .setColor(0x010101);

            try { 
                const dmEmbed = new EmbedBuilder()
                    .setTitle(`${STORE_NAME} - تأكيد الطلب`)
                    .setDescription('# ✅ تم استلام طلبك بنجاح.\n\n# يرجى الانتظار، سيتم التواصل معك قريباً من قبل الإدارة.')
                    .setThumbnail(THUMBNAIL_URL)
                    .setImage(BANNER_URL)
                    .setColor(0x010101);

                await interaction.user.send({ embeds: [dmEmbed] }); 
            } catch(e) {}
            
            return interaction.update({ 
                content: `<@${interaction.user.id}> تنبيه للإدارة: <@&${TARGET_ROLE_ID}>`, 
                embeds: [embed], 
                components: [] 
            });
        } else {
            const embed = new EmbedBuilder()
                .setTitle(STORE_NAME)
                .setDescription('# 🔄 تحويل العملة\n\n# يرجى التحويل إلى الأيدي:\n`1468991040911310951`\n\n# (المطلوب: 450,000,000)')
                .setThumbnail(THUMBNAIL_URL)
                .setImage(BANNER_URL)
                .setColor(0x010101);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('verify_fbt_payment').setLabel('✅ تحقق الدفع').setStyle(ButtonStyle.Success)
            );
            return interaction.update({ embeds: [embed], components: [row] });
        }
    }

    if (interaction.customId === 'verify_fbt_payment') {
        const userId = interaction.user.id;
        const currentBalance = userBalances.get(userId) || 0;
        const requiredAmount = 450000000;

        if (currentBalance < requiredAmount) {
            return interaction.reply({ content: `❌ رصيدك غير كافي! رصيدك الحالي: **${currentBalance.toLocaleString()}** والمطلوب: **450,000,000**.`, ephemeral: true });
        }

        userBalances.set(userId, currentBalance - requiredAmount);

        const embed = new EmbedBuilder()
            .setTitle(STORE_NAME)
            .setDescription('# ✅ تم!\n\n# تم خصم 450,000,000 بنجاح، اضغط أدناه لفتح صفحة المنتج.')
            .setThumbnail(THUMBNAIL_URL)
            .setImage(BANNER_URL)
            .setColor(0x010101);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_product_modal').setLabel('📂 فتح صفحة المنتج').setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.isButton() && interaction.customId === 'open_product_modal') {
        const modal = new ModalBuilder().setCustomId('final_product_modal').setTitle('تفاصيل المنتج');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('product_name').setLabel('اسم المنتج').setStyle(TextInputStyle.Short).setRequired(true)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('product_desc').setLabel('وصف المنتج').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'final_product_modal') {
        const name = interaction.fields.getTextInputValue('product_name');
        const desc = interaction.fields.getTextInputValue('product_desc');

        tempProductData.set(interaction.user.id, { name, desc });

        const confirmEmbed = new EmbedBuilder()
            .setTitle(`⚠️ ${STORE_NAME} - تأكيد النشر`)
            .setDescription('هل أنت متأكد من رغبتك في نشر هذا المنتج؟\n\n# صاحب المنتج\n<@' + interaction.user.id + '>\n\n# اسم المنتج\n' + name + '\n\n# وصف المنتج\n' + desc)
            .setThumbnail(THUMBNAIL_URL)
            .setImage(BANNER_URL)
            .setColor(0x010101);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_publish').setLabel('✅ تأكيد النشر').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_publish').setLabel('❌ إلغاء').setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: false });
    }

    if (interaction.customId === 'confirm_publish') {
        const productData = tempProductData.get(interaction.user.id);
        if (!productData) {
            return interaction.reply({ content: '❌ انتهت صلاحية الجلسة، يرجى إعادة المحاولة.', ephemeral: true });
        }

        const currentProducts = userProductCount.get(interaction.user.id) || 0;
        userProductCount.set(interaction.user.id, currentProducts + 1);

        const finalEmbed = new EmbedBuilder()
            .setTitle(`📦 ${STORE_NAME} - تفاصيل المنتج`)
            .setDescription('# صاحب المنتج\n<@' + interaction.user.id + '>\n\n# اسم المنتج\n' + productData.name + '\n\n# وصف المنتج\n' + productData.desc)
            .setThumbnail(THUMBNAIL_URL)
            .setImage(BANNER_URL)
            .setColor(0x010101);

        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                await logChannel.send({
                    content: `👤 صاحب المنتج: <@${interaction.user.id}>`,
                    embeds: [finalEmbed]
                });
            }
        } catch (e) {
            console.log('Could not send to log channel:', e);
        }

        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle(`🎉 ${STORE_NAME} - تم نشر منتجك بنجاح!`)
                .setDescription('# ✨ شكراً لك على ثقتك بمتجرنا\n\n# تفاصيل منتجك المعروض:\n\n# صاحب المنتج\n<@' + interaction.user.id + '>\n\n# اسم المنتج\n' + productData.name + '\n\n# وصف المنتج\n' + productData.desc)
                .setThumbnail(THUMBNAIL_URL)
                .setImage(BANNER_URL)
                .setColor(0x010101);

            await interaction.user.send({ embeds: [dmEmbed] });
        } catch (e) {
            console.log('Could not send DM to user:', e);
        }

        tempProductData.delete(interaction.user.id);

        try {
            if (interaction.channel && interaction.channel.deletable) {
                await interaction.channel.delete();
            }
        } catch (e) {
            console.log('Could not delete channel:', e);
        }
    }
});

client.login('MTUzNjkxNTkzMzUwNjA0ODE1Mg.GL-HaJ.N0t6_lhDMYybVr5s5iBpB-fTtxjktxAa0LkxQE');