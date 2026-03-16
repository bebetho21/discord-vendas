// ╔══════════════════════════════════════════════════════════════════╗
// ║               BOT DISCORD — discord.js v14                      ║
// ║         Sistema de Licença por Servidor — Pronto para Railway    ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// INSTRUÇÕES RAILWAY:
//   1. Suba este arquivo (index.js) e o package.json para o Railway.
//   2. Defina a variável de ambiente TOKEN com o token do seu bot.
//   3. O arquivo licenses.json será criado automaticamente na primeira ativação.
//   4. Edite as constantes abaixo conforme seu servidor.

'use strict';

const fs = require('fs');
const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    PermissionFlagsBits,
} = require('discord.js');

// ══════════════════════════════════════════════════════════════════════
//  CONFIGURAÇÕES — edite estes valores antes de subir no Railway
// ══════════════════════════════════════════════════════════════════════
const STAFF_ROLE_ID       = 'SEU_ID_CARGO_STAFF';     // ID do cargo Staff
const CLIENT_ROLE_ID      = 'SEU_ID_CARGO_CLIENTE';   // ID do cargo Cliente
const FEEDBACK_CHANNEL_ID = 'SEU_ID_CANAL_FEEDBACK';  // ID do canal de avaliações
const PREFIX              = '!';

// ══════════════════════════════════════════════════════════════════════
//  SISTEMA DE LICENÇA
// ══════════════════════════════════════════════════════════════════════
//
//  → Adicione aqui as chaves que você vai distribuir para seus clientes.
//  → Cada chave pode ser ativada em apenas UM servidor.
//  → Use !ativar <chave> no Discord para ativar (somente o Dono do servidor).
//
const VALID_KEYS = [
    'CHAVE-AAAA-1111',
    'CHAVE-BBBB-2222',
    'CHAVE-CCCC-3333',
    // Adicione mais chaves conforme necessário...
];

// Caminho do arquivo onde as licenças ativadas ficam salvas.
// Na Railway, o arquivo é criado na raiz do projeto automaticamente.
const LICENSE_FILE = './licenses.json';

/**
 * Lê o arquivo licenses.json e retorna o objeto com as licenças.
 * Se o arquivo não existir, retorna um objeto vazio.
 * Formato: { "guildId": { key: "CHAVE-XXXX", activatedAt: "ISO date" } }
 */
function loadLicenses() {
    if (!fs.existsSync(LICENSE_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
    } catch (e) {
        console.error('[LICENÇA] Erro ao ler licenses.json:', e.message);
        return {};
    }
}

/**
 * Salva o objeto de licenças no arquivo licenses.json.
 */
function saveLicenses(data) {
    try {
        fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('[LICENÇA] Erro ao salvar licenses.json:', e.message);
    }
}

/**
 * Verifica se um servidor (pelo guildId) tem licença ativa.
 * Retorna true ou false.
 */
function isLicensed(guildId) {
    return !!loadLicenses()[guildId];
}

/**
 * Tenta ativar uma chave de licença para um servidor.
 *
 * Regras:
 *  - A chave deve existir em VALID_KEYS (case-insensitive).
 *  - A chave não pode estar em uso por OUTRO servidor.
 *  - Se o servidor já tiver licença ativa, informa sem sobrescrever.
 *
 * Retorna: { success: boolean, message: string }
 */
function activateLicense(guildId, inputKey) {
    const key      = inputKey.trim().toUpperCase();
    const validSet = VALID_KEYS.map(k => k.toUpperCase());

    // 1. Chave inexistente na lista?
    if (!validSet.includes(key)) {
        return { success: false, message: '❌ Chave de licença inválida.' };
    }

    const licenses = loadLicenses();

    // 2. A chave já está sendo usada em OUTRO servidor?
    for (const [id, data] of Object.entries(licenses)) {
        if (data.key.toUpperCase() === key && id !== guildId) {
            return { success: false, message: '❌ Esta chave já está em uso em outro servidor.' };
        }
    }

    // 3. Este servidor já possui licença ativa?
    if (licenses[guildId]) {
        return {
            success: false,
            message: `✅ Este servidor já possui a licença \`${licenses[guildId].key}\` ativa.`,
        };
    }

    // 4. Tudo certo — ativa a licença para este servidor
    licenses[guildId] = { key, activatedAt: new Date().toISOString() };
    saveLicenses(licenses);
    return { success: true, message: `✅ Licença \`${key}\` ativada com sucesso neste servidor!` };
}

// ══════════════════════════════════════════════════════════════════════
//  DADOS ISOLADOS POR SERVIDOR (Map com guildId como chave)
//
//  Cada servidor tem seu próprio produto e variação selecionada.
//  Isso evita que um servidor sobrescreva os dados de outro.
// ══════════════════════════════════════════════════════════════════════

// Último produto criado por servidor: Map<guildId, produtoObj>
const lastProductPerGuild = new Map();

// Variação selecionada no select menu por servidor: Map<guildId, string>
const selectedVarPerGuild = new Map();

// ══════════════════════════════════════════════════════════════════════
//  FUNÇÕES AUXILIARES
// ══════════════════════════════════════════════════════════════════════

/** Retorna true se o membro for Staff ou Dono do servidor. */
function isStaffOrOwner(member, guild) {
    return member.roles.cache.has(STAFF_ROLE_ID) || guild.ownerId === member.id;
}

// ══════════════════════════════════════════════════════════════════════
//  CLIENT DISCORD
// ══════════════════════════════════════════════════════════════════════
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.on('ready', () => {
    console.log(`[BOT] Logado como ${client.user.tag}`);
    console.log(`[LICENÇA] Servidores licenciados: ${Object.keys(loadLicenses()).length}`);
});

// ══════════════════════════════════════════════════════════════════════
//  HANDLER DE MENSAGENS (COMANDOS COM PREFIXO)
// ══════════════════════════════════════════════════════════════════════
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args    = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const guildId = message.guild.id;

    // ──────────────────────────────────────────────────────────────────
    //  !ativar <chave>  — Ativa a licença no servidor (somente o Dono)
    // ──────────────────────────────────────────────────────────────────
    if (command === 'ativar') {
        if (message.guild.ownerId !== message.author.id) {
            return message.reply('❌ Apenas o **Dono do servidor** pode ativar a licença.');
        }
        const chave = args[0];
        if (!chave) {
            return message.reply('❌ Uso correto: `!ativar <chave>`\nExemplo: `!ativar CHAVE-AAAA-1111`');
        }
        const resultado = activateLicense(guildId, chave);
        const embed = new EmbedBuilder()
            .setDescription(resultado.message)
            .setColor(resultado.success ? 'Green' : 'Red')
            .setTimestamp();
        return message.reply({ embeds: [embed] });
    }

    // ──────────────────────────────────────────────────────────────────
    //  VERIFICAÇÃO DE LICENÇA — bloqueia todos os outros comandos se
    //  o servidor não tiver licença ativa.
    // ──────────────────────────────────────────────────────────────────
    if (!isLicensed(guildId)) {
        return message.reply(
            '⚠️ **Este servidor não possui uma licença ativa.**\n' +
            'O Dono do servidor deve usar `!ativar <chave>` para liberar o bot.\n' +
            'Exemplo: `!ativar CHAVE-AAAA-1111`'
        );
    }

    // !ping
    if (command === 'ping') {
        return message.reply(`🏓 Pong! Latência: **${client.ws.ping}ms**`);
    }

    // !say
    if (command === 'say') {
        const text = args.join(' ');
        if (!text) return message.reply('Informe o texto a ser repetido.');
        message.delete().catch(() => {});
        return message.channel.send(text);
    }

    // !embed
    if (command === 'embed') {
        const embed = new EmbedBuilder()
            .setTitle('Exemplo de Embed')
            .setDescription('Este é um embed de exemplo gerado pelo bot.')
            .setColor('Blue');
        return message.channel.send({ embeds: [embed] });
    }

    // !avatar
    if (command === 'avatar') {
        const user = message.mentions.users.first() || message.author;
        const embed = new EmbedBuilder()
            .setTitle(`Avatar de ${user.username}`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setColor('Random');
        return message.channel.send({ embeds: [embed] });
    }

    // !serverinfo
    if (command === 'serverinfo') {
        const { guild } = message;
        const embed = new EmbedBuilder()
            .setTitle(`Informações: ${guild.name}`)
            .setThumbnail(guild.iconURL())
            .addFields(
                { name: 'Membros',   value: `${guild.memberCount}`,                               inline: true },
                { name: 'Dono',      value: `<@${guild.ownerId}>`,                                inline: true },
                { name: 'Criado em', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setColor('Purple');
        return message.channel.send({ embeds: [embed] });
    }

    // !userinfo
    if (command === 'userinfo') {
        const member = message.mentions.members.first() || message.member;
        const embed = new EmbedBuilder()
            .setTitle(`Info: ${member.user.username}`)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: 'ID',               value: member.id,                                                  inline: true },
                { name: 'Entrou no server',  value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,      inline: true },
                { name: 'Conta criada',     value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setColor('Green');
        return message.channel.send({ embeds: [embed] });
    }

    // !clear
    if (command === 'clear') {
        if (!isStaffOrOwner(message.member, message.guild)) {
            return message.reply('❌ Apenas **Staff** ou o **Dono** podem usar este comando.');
        }
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply('Informe um número entre **1** e **100**.');
        }
        await message.channel.bulkDelete(amount + 1, true);
        const aviso = await message.channel.send(`🧹 **${amount}** mensagens deletadas.`);
        setTimeout(() => aviso.delete().catch(() => {}), 3000);
        return;
    }

    // !help
    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('📋 Comandos do Bot')
            .addFields(
                { name: '🔧 Gerais',        value: '`ping` `say` `embed` `avatar` `serverinfo` `userinfo` `help`' },
                { name: '🛡️ Staff / Dono', value: '`clear` `criarproduto` `enviarproduto` `cliente @user`' },
                { name: '⭐ Outros',        value: '`avaliar`' },
                { name: '🔑 Licença',       value: '`ativar <chave>` — ativa o bot neste servidor (somente Dono)' }
            )
            .setColor('Gold');
        return message.channel.send({ embeds: [embed] });
    }

    // !cliente
    if (command === 'cliente') {
        if (!isStaffOrOwner(message.member, message.guild)) {
            return message.reply('❌ Apenas **Staff** ou o **Dono**.');
        }
        const target = message.mentions.members.first();
        if (!target) return message.reply('Mencione um usuário. Ex: `!cliente @usuario`');
        await target.roles.add(CLIENT_ROLE_ID).catch(() => {});
        const embed = new EmbedBuilder()
            .setDescription(`✅ Cargo de **Cliente** adicionado para ${target}.`)
            .setColor('Green');
        return message.channel.send({ embeds: [embed] });
    }

    // !criarproduto
    if (command === 'criarproduto') {
        if (!isStaffOrOwner(message.member, message.guild)) {
            return message.reply('❌ Apenas **Staff** ou o **Dono**.');
        }
        const filter = m => m.author.id === message.author.id && m.channel.id === message.channel.id;
        try {
            const ask = async (pergunta) => {
                await message.channel.send(pergunta);
                const col = await message.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
                return col.first().content.trim();
            };
            const nome      = await ask('📌 Qual o **nome** do produto?');
            const preco     = await ask('💰 Qual o **preço**?');
            const desc      = await ask('📝 Qual a **descrição**?');
            const imgUrl    = await ask('🖼️ Qual a **URL da imagem**? (deve começar com http/https)');
            if (!imgUrl.startsWith('http')) {
                return message.reply('❌ URL inválida. Deve começar com `http://` ou `https://`.');
            }
            const varsRaw   = await ask('🎛️ Quantas **variações** deseja? (1 a 25)');
            const varsCount = parseInt(varsRaw);
            if (isNaN(varsCount) || varsCount < 1 || varsCount > 25) {
                return message.reply('❌ Número de variações inválido. Use entre 1 e 25.');
            }
            const options = Array.from({ length: varsCount }, (_, i) => ({
                label:       `Variação ${i + 1}`,
                value:       `var_${i + 1}`,
                description: `Opção número ${i + 1}`,
            }));
            const selectRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_prod')
                    .setPlaceholder('Selecione uma variação antes de comprar')
                    .addOptions(options)
            );
            const botoesRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('buy_btn').setLabel('🛒 Comprar').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('info_btn').setLabel('ℹ️ Informações').setStyle(ButtonStyle.Primary)
            );
            const embed = new EmbedBuilder()
                .setTitle(nome)
                .setDescription(desc)
                .addFields({ name: '💰 Preço', value: preco })
                .setImage(imgUrl)
                .setColor('Blue');
            // Produto salvo isolado por servidor
            lastProductPerGuild.set(guildId, {
                embeds:     [embed],
                components: [selectRow, botoesRow],
                data:       { nome, preco, desc, imgUrl },
            });
            return message.reply('✅ Produto criado! Use `!enviarproduto` para enviá-lo a um canal.');
        } catch {
            return message.reply('⏱️ Tempo esgotado ou erro na criação do produto. Tente novamente.');
        }
    }

    // !enviarproduto
    if (command === 'enviarproduto') {
        if (!isStaffOrOwner(message.member, message.guild)) {
            return message.reply('❌ Apenas **Staff** ou o **Dono**.');
        }
        // Busca produto DESTE servidor
        if (!lastProductPerGuild.has(guildId)) {
            return message.reply('❌ Nenhum produto criado ainda. Use `!criarproduto` primeiro.');
        }
        const selectCanal = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
                .setCustomId('select_channel')
                .setChannelTypes([ChannelType.GuildText])
                .setPlaceholder('Selecione o canal onde o produto será enviado')
        );
        return message.reply({ content: '📢 Onde deseja enviar o produto?', components: [selectCanal] });
    }

    // !avaliar
    if (command === 'avaliar') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('star_1').setLabel('⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('star_2').setLabel('⭐⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('star_3').setLabel('⭐⭐⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('star_4').setLabel('⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('star_5').setLabel('⭐⭐⭐⭐⭐').setStyle(ButtonStyle.Secondary)
        );
        return message.reply({ content: '⭐ Como você avalia nosso serviço?', components: [row] });
    }
});

// ══════════════════════════════════════════════════════════════════════
//  HANDLER DE INTERAÇÕES (botões, selects)
// ══════════════════════════════════════════════════════════════════════
client.on('interactionCreate', async (interaction) => {
    if (!interaction.guild) return;
    const guildId = interaction.guild.id;

    // Bloqueia servidores sem licença
    if (!isLicensed(guildId)) {
        return interaction.reply({
            content: '⚠️ Este servidor não possui licença ativa. O Dono deve usar `!ativar <chave>`.',
            ephemeral: true,
        });
    }

    try {

        // Select Menu: variação de produto
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_prod') {
            // Armazena variação isolada por servidor
            selectedVarPerGuild.set(guildId, interaction.values[0]);
            return interaction.deferUpdate();
        }

        // Select Menu: canal para envio de produto
        if (interaction.isChannelSelectMenu() && interaction.customId === 'select_channel') {
            const produto = lastProductPerGuild.get(guildId);
            if (!produto) {
                return interaction.reply({ content: '❌ Nenhum produto disponível. Use `!criarproduto`.', ephemeral: true });
            }
            const canal = interaction.guild.channels.cache.get(interaction.values[0]);
            if (!canal) {
                return interaction.reply({ content: '❌ Canal não encontrado.', ephemeral: true });
            }
            await canal.send({ embeds: produto.embeds, components: produto.components });
            return interaction.reply({ content: `✅ Produto enviado em ${canal}!`, ephemeral: true });
        }

        if (interaction.isButton()) {

            // Botão: Informações
            if (interaction.customId === 'info_btn') {
                const embed = interaction.message.embeds[0];
                return interaction.reply({ content: `ℹ️ **Descrição:** ${embed.description}`, ephemeral: true });
            }

            // Botão: Comprar → cria ticket
            if (interaction.customId === 'buy_btn') {
                const variacao    = selectedVarPerGuild.get(guildId) || 'Nenhuma variação selecionada';
                const nomeProduto = interaction.message.embeds[0]?.title || 'Produto';
                const nomeCanalTicket = `ticket-${interaction.user.username}`
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, '')
                    .slice(0, 50);

                const canalTicket = await interaction.guild.channels.create({
                    name: nomeCanalTicket,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny:  [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id,  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        { id: STAFF_ROLE_ID,        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    ],
                });

                const embedTicket = new EmbedBuilder()
                    .setTitle('🛒 Novo Pedido')
                    .addFields(
                        { name: '👤 Usuário',   value: `${interaction.user}`, inline: true },
                        { name: '📦 Produto',   value: nomeProduto,           inline: true },
                        { name: '🎛️ Variação', value: variacao,             inline: true },
                    )
                    .setDescription('Aguarde um **ADM** responder.')
                    .setColor('Green')
                    .setTimestamp();

                const rowFechar = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('🔒 Fechar Ticket')
                        .setStyle(ButtonStyle.Danger)
                );

                await canalTicket.send({
                    content:    `<@&${STAFF_ROLE_ID}> — Novo ticket de ${interaction.user}`,
                    embeds:     [embedTicket],
                    components: [rowFechar],
                });

                return interaction.reply({ content: `✅ Ticket criado: ${canalTicket}`, ephemeral: true });
            }

            // Botão: Fechar Ticket
            if (interaction.customId === 'close_ticket') {
                if (!isStaffOrOwner(interaction.member, interaction.guild)) {
                    return interaction.reply({ content: '❌ Apenas **Staff** ou o **Dono** pode fechar tickets.', ephemeral: true });
                }
                await interaction.reply('🔒 Ticket será deletado em **5 segundos**...');
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
                return;
            }

            // Botões de estrela (avaliação)
            if (interaction.customId.startsWith('star_')) {
                const qtdEstrelas = parseInt(interaction.customId.split('_')[1]);
                const estrelas    = '⭐'.repeat(qtdEstrelas);

                await interaction.reply({ content: '📝 Agora **escreva sua avaliação** no chat:', ephemeral: true });

                const filtroMsg = m => m.author.id === interaction.user.id;
                const collector = interaction.channel.createMessageCollector({ filter: filtroMsg, max: 1, time: 90_000 });

                collector.on('collect', async (m) => {
                    const canalFeedback = interaction.guild.channels.cache.get(FEEDBACK_CHANNEL_ID);
                    if (!canalFeedback) return m.reply('❌ Canal de feedbacks não configurado.');

                    const embedFeedback = new EmbedBuilder()
                        .setTitle('💬 Nova Avaliação')
                        .addFields(
                            { name: '👤 Usuário',    value: `${interaction.user.tag}`, inline: true },
                            { name: '⭐ Nota',       value: estrelas,                  inline: true },
                            { name: '💬 Comentário', value: m.content }
                        )
                        .setThumbnail(interaction.user.displayAvatarURL())
                        .setColor('Yellow')
                        .setTimestamp();

                    await canalFeedback.send({ embeds: [embedFeedback] });
                    await m.reply('✅ Obrigado pela sua avaliação!');
                });

                collector.on('end', (col) => {
                    if (col.size === 0) {
                        interaction.channel.send(`${interaction.user} ⏱️ Tempo esgotado para avaliação.`).catch(() => {});
                    }
                });

                return;
            }
        }

    } catch (err) {
        console.error('[ERRO interação]', err);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Ocorreu um erro inesperado. Tente novamente.', ephemeral: true });
            }
        } catch (_) {}
    }
});

// ══════════════════════════════════════════════════════════════════════
//  LOGIN — TOKEN via variável de ambiente (defina TOKEN no Railway)
// ══════════════════════════════════════════════════════════════════════
client.login(process.env.TOKEN);