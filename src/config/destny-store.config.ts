export const config = {
  "version": 16,
  "name": "Destny Store",
  "everyone": [
    "ViewChannel",
    "SendMessages",
    "ReadMessageHistory",
    "AddReactions",
    "AttachFiles",
    "Connect",
    "Speak",
    "Stream",
    "UseVAD",
    "UseApplicationCommands"
  ],
  "roles": [
    {
      "key": "role-1",
      "name": "👑 Owner",
      "color": 16724812,
      "hoist": true,
      "permissions": [
        "Administrator"
      ]
    },
    {
      "key": "role-2",
      "name": "☁️ Cofundador",
      "color": 14689854,
      "hoist": true,
      "permissions": [
        "Administrator"
      ]
    },
    {
      "key": "role-3",
      "name": "🩸 Administrador",
      "color": 12198198,
      "hoist": true,
      "permissions": [
        "ManageChannels",
        "ViewAuditLog",
        "ManageMessages",
        "ManageThreads",
        "KickMembers",
        "BanMembers",
        "ModerateMembers",
        "ManageNicknames",
        "MuteMembers",
        "DeafenMembers",
        "MoveMembers"
      ]
    },
    {
      "key": "role-4",
      "name": "🛡️ Moderador",
      "color": 12173000,
      "hoist": true,
      "permissions": [
        "ManageMessages",
        "ManageThreads",
        "ModerateMembers",
        "MuteMembers",
        "DeafenMembers",
        "MoveMembers"
      ]
    },
    {
      "key": "role-5",
      "name": "🎫 Atendente",
      "color": 14737632,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-6",
      "name": "👑 Cliente VIP",
      "color": 15219544,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-7",
      "name": "💎 Diamante II",
      "color": 8494583,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-8",
      "name": "💎 Diamante I",
      "color": 8494583,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-9",
      "name": "💠 Platina II",
      "color": 7588305,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-10",
      "name": "💠 Platina I",
      "color": 7588305,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-11",
      "name": "🥇 Ouro III",
      "color": 14858310,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-12",
      "name": "🥇 Ouro II",
      "color": 14858310,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-13",
      "name": "🥇 Ouro I",
      "color": 14858310,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-14",
      "name": "🥈 Prata III",
      "color": 11187395,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-15",
      "name": "🥈 Prata II",
      "color": 11187395,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-16",
      "name": "🥈 Prata I",
      "color": 11187395,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-17",
      "name": "🥉 Bronze III",
      "color": 12024650,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-18",
      "name": "🥉 Bronze II",
      "color": 12024650,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-19",
      "name": "🥉 Bronze I",
      "color": 12024650,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-20",
      "name": "✅ Cliente",
      "color": 10134706,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-21",
      "name": "🤝 Parceiro",
      "color": 13212530,
      "hoist": true,
      "permissions": []
    },
    {
      "key": "role-22",
      "name": "💜 Booster",
      "color": 12160239,
      "hoist": false,
      "permissions": []
    },
    {
      "key": "role-23",
      "name": "👤 Membro",
      "color": 8686228,
      "hoist": false,
      "permissions": []
    },
    {
      "key": "role-24",
      "name": "🎁 Promoções",
      "color": 12797013,
      "hoist": false,
      "permissions": []
    },
    {
      "key": "role-25",
      "name": "🎉 Sorteios",
      "color": 14316928,
      "hoist": false,
      "permissions": []
    },
    {
      "key": "role-26",
      "name": "📢 Atualizações",
      "color": 10120053,
      "hoist": false,
      "permissions": []
    }
  ],
  "categories": [
    {
      "key": "category-01",
      "name": "🚪 • 𝗘𝗡𝗧𝗥𝗔𝗗𝗔",
      "channels": [
        {
          "key": "channel-01-1",
          "name": "「👋」ʙᴏᴀꜱ-ᴠɪɴᴅᴀꜱ",
          "type": 0,
          "position": 0
        },
        {
          "key": "channel-01-2",
          "name": "「📜」ʀᴇɢʀᴀꜱ",
          "type": 0,
          "position": 1
        }
      ],
      "position": 1,
      "access": "read",
      "staff": {
        "admin": "inherit",
        "moderator": "inherit",
        "attendant": "inherit"
      }
    },
    {
      "key": "category-02",
      "name": "📢 • 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗖𝗢𝗘𝗦",
      "channels": [
        {
          "key": "channel-02-2",
          "name": "「📣」ᴀɴᴜɴᴄɪᴏꜱ",
          "type": 0,
          "position": 0
        },
        {
          "key": "channel-02-3",
          "name": "「🔗」ᴄᴏɴᴠɪᴛᴇꜱ",
          "type": 0,
          "position": 1
        },
        {
          "key": "channel-02-4",
          "name": "「📬」ɴᴏᴛɪꜰɪᴄᴀᴄᴏᴇꜱ",
          "type": 0,
          "position": 2
        }
      ],
      "position": 2,
      "access": "read",
      "staff": {
        "admin": "publish",
        "moderator": "inherit",
        "attendant": "inherit"
      }
    },
    {
      "key": "category-03",
      "name": "🌙 • 𝗖𝗢𝗠𝗨𝗡𝗜𝗗𝗔𝗗𝗘",
      "channels": [
        {
          "key": "channel-03-1",
          "name": "「💭」ᴄʜᴀᴛ",
          "type": 0,
          "position": 0,
          "rate_limit_per_user": 5
        },
        {
          "key": "channel-03-2",
          "name": "「📸」ᴍɪᴅɪᴀ",
          "type": 0,
          "position": 1,
          "rate_limit_per_user": 0
        },
        {
          "key": "channel-03-3",
          "name": "「🎉」ꜱᴏʀᴛᴇɪᴏꜱ",
          "type": 0,
          "position": 2
        },
        {
          "key": "channel-03-4",
          "name": "「💡」ꜱᴜɢᴇꜱᴛᴏᴇꜱ",
          "type": 0,
          "position": 3,
          "rate_limit_per_user": 15
        },
        {
          "key": "channel-03-5",
          "name": "「🗳️」ᴇɴQᴜᴇᴛᴇꜱ",
          "type": 0,
          "position": 4,
          "rate_limit_per_user": 0,
          "polls": true
        },
        {
          "key": "channel-03-6",
          "name": "「🔊」ɢᴇʀᴀʟ",
          "type": 2,
          "position": 5,
          "bitrate": 64000,
          "user_limit": 0,
          "rtc_region": null
        }
      ],
      "position": 3,
      "access": "publish",
      "staff": {
        "admin": "publish",
        "moderator": "publish",
        "attendant": "inherit"
      }
    },
    {
      "key": "category-04",
      "name": "🛒 • 𝗟𝗢𝗝𝗔",
      "channels": [
        {
          "key": "channel-02-1",
          "name": "「🔔」ᴀᴛᴜᴀʟɪᴢᴀᴄᴏᴇꜱ",
          "type": 0,
          "position": 0
        },
        {
          "key": "channel-04-1",
          "name": "「📋」ᴄᴀᴛᴀʟᴏɢᴏ",
          "type": 0,
          "position": 1
        },
        {
          "key": "channel-04-2",
          "name": "「📖」ᴄᴏᴍᴏ-ᴄᴏᴍᴘʀᴀʀ",
          "type": 0,
          "position": 2
        },
        {
          "key": "channel-04-3",
          "name": "「📑」ᴛᴇʀᴍᴏꜱ-ᴅᴀ-ʟᴏᴊᴀ",
          "type": 0,
          "position": 3
        },
        {
          "key": "channel-04-4",
          "name": "「🎁」ᴘʀᴏᴍᴏᴄᴏᴇꜱ",
          "type": 0,
          "position": 4
        },
        {
          "key": "channel-04-5",
          "name": "「🏅」ʙᴇɴᴇꜰɪᴄɪᴏꜱ",
          "type": 0,
          "position": 5
        }
      ],
      "position": 4,
      "access": "read",
      "staff": {
        "admin": "publish",
        "moderator": "inherit",
        "attendant": "publish"
      }
    },
    {
      "key": "category-05",
      "name": "🎫 • 𝗔𝗧𝗘𝗡𝗗𝗜𝗠𝗘𝗡𝗧𝗢",
      "channels": [
        {
          "key": "channel-05-1",
          "name": "「📩」ᴀʙʀɪʀ-ᴛɪᴄᴋᴇᴛ",
          "type": 0,
          "position": 0
        },
        {
          "key": "channel-05-2",
          "name": "「❓」ᴅᴜᴠɪᴅᴀꜱ-ꜰʀᴇQᴜᴇɴᴛᴇꜱ",
          "type": 0,
          "position": 1
        }
      ],
      "position": 5,
      "access": "read",
      "staff": {
        "admin": "publish",
        "moderator": "publish",
        "attendant": "publish"
      }
    },
    {
      "key": "category-06",
      "name": "✅ • 𝗔𝗩𝗔𝗟𝗜𝗔𝗖𝗢𝗘𝗦",
      "channels": [
        {
          "key": "channel-06-1",
          "name": "「💬」ꜰᴇᴇᴅʙᴀᴄᴋꜱ",
          "type": 0,
          "position": 0
        },
        {
          "key": "channel-06-2",
          "name": "「📦」ᴇɴᴛʀᴇɢᴀꜱ",
          "type": 0,
          "position": 1
        }
      ],
      "position": 6,
      "access": "read",
      "staff": {
        "admin": "publish",
        "moderator": "inherit",
        "attendant": "publish"
      }
    },
    {
      "key": "category-07",
      "name": "👤 • 𝗖𝗢𝗡𝗧𝗔𝗦",
      "channels": [
        {
          "key": "channel-07-1",
          "name": "「🛒」ᴅɪꜱᴘᴏɴɪᴠᴇɪꜱ",
          "type": 0,
          "position": 0
        },
        {
          "key": "channel-07-2",
          "name": "「🎨」ᴘᴇʀꜱᴏɴᴀʟɪᴢᴀᴠᴇɪꜱ",
          "type": 0,
          "position": 1
        }
      ],
      "position": 7,
      "access": "read",
      "staff": {
        "admin": "publish",
        "moderator": "inherit",
        "attendant": "publish"
      }
    },
    {
      "key": "category-08",
      "name": "👹 • 𝗙𝗔𝗥𝗠",
      "channels": [
        {
          "key": "channel-08-1",
          "name": "「⚔️」ʙᴏꜱꜱ",
          "type": 0,
          "position": 0
        },
        {
          "key": "channel-08-2",
          "name": "「❄️」ʏᴇᴛɪ",
          "type": 0,
          "position": 1
        }
      ],
      "position": 8,
      "access": "read",
      "staff": {
        "admin": "publish",
        "moderator": "inherit",
        "attendant": "publish"
      }
    },
    {
      "key": "category-09",
      "name": "🗡️ • 𝗔𝗥𝗠𝗔𝗦",
      "channels": [
        {
          "key": "channel-09-1",
          "name": "「⚔️」ʙᴀꜱᴇ",
          "type": 0,
          "position": 0
        },
        {
          "key": "channel-09-2",
          "name": "「🔨」ᴅᴀᴍᴀꜱᴄᴜꜱ",
          "type": 0,
          "position": 1
        },
        {
          "key": "channel-09-3",
          "name": "「🌑」ɴɪɢʜᴛꜰᴀʟʟ",
          "type": 0,
          "position": 2
        },
        {
          "key": "channel-09-4",
          "name": "「🌅」ꜰɪʀꜱᴛʟɪɢʜᴛ",
          "type": 0,
          "position": 3
        }
      ],
      "position": 9,
      "access": "read",
      "staff": {
        "admin": "publish",
        "moderator": "inherit",
        "attendant": "publish"
      }
    },
    {
      "key": "category-10",
      "name": "🎭 • 𝗔𝗖𝗘𝗦𝗦𝗢𝗥𝗜𝗢𝗦",
      "channels": [
        {
          "key": "channel-10-1",
          "name": "「🎭」ʙᴀꜱᴇ",
          "type": 0,
          "position": 0
        },
        {
          "key": "channel-10-2",
          "name": "「🌑」ɴɪɢʜᴛꜰᴀʟʟ",
          "type": 0,
          "position": 1
        },
        {
          "key": "channel-10-3",
          "name": "「🌅」ꜰɪʀꜱᴛʟɪɢʜᴛ",
          "type": 0,
          "position": 2
        }
      ],
      "position": 10,
      "access": "read",
      "staff": {
        "admin": "publish",
        "moderator": "inherit",
        "attendant": "publish"
      }
    },
    {
      "key": "category-11",
      "name": "📈 • 𝗫𝗣",
      "channels": [
        {
          "key": "channel-11-1",
          "name": "「🥋」ᴍᴀᴇꜱᴛʀɪᴀ",
          "type": 0,
          "position": 0
        },
        {
          "key": "channel-11-2",
          "name": "「📊」ʟᴇᴠᴇʟ",
          "type": 0,
          "position": 1
        }
      ],
      "position": 11,
      "access": "read",
      "staff": {
        "admin": "publish",
        "moderator": "inherit",
        "attendant": "publish"
      }
    },
    {
      "key": "category-12",
      "name": "💎 • 𝗠𝗔𝗧𝗘𝗥𝗜𝗔𝗜𝗦",
      "channels": [
        {
          "key": "channel-12-1",
          "name": "「💠」ᴏʀᴇꜱ",
          "type": 0,
          "position": 0
        },
        {
          "key": "channel-12-2",
          "name": "「💰」ᴍᴏɴᴇʏ",
          "type": 0,
          "position": 1
        },
        {
          "key": "channel-12-3",
          "name": "「✨」ᴍɪᴛɪᴄᴏꜱ",
          "type": 0,
          "position": 2
        },
        {
          "key": "channel-12-4",
          "name": "「🔧」ʀᴇꜰɪɴᴇᴍᴇɴᴛ",
          "type": 0,
          "position": 3
        }
      ],
      "position": 12,
      "access": "read",
      "staff": {
        "admin": "publish",
        "moderator": "inherit",
        "attendant": "publish"
      }
    },
    {
      "key": "category-13",
      "name": "🔒 • 𝗘𝗤𝗨𝗜𝗣𝗘",
      "channels": [
        {
          "key": "channel-13-1",
          "name": "「📢」ᴀᴠɪꜱᴏꜱ-ꜱᴛᴀꜰꜰ",
          "type": 0,
          "position": 0
        },
        {
          "key": "channel-13-2",
          "name": "「💬」ᴄʜᴀᴛ-ꜱᴛᴀꜰꜰ",
          "type": 0,
          "position": 1
        },
        {
          "key": "channel-13-3",
          "name": "「📋」ᴘᴇᴅɪᴅᴏꜱ",
          "type": 0,
          "position": 2
        },
        {
          "key": "channel-13-4",
          "name": "「🤖」ᴄᴏᴍᴀɴᴅᴏꜱ",
          "type": 0,
          "position": 3
        }
      ],
      "position": 13,
      "access": "hidden",
      "staff": {
        "admin": "publish",
        "moderator": "publish",
        "attendant": "publish"
      }
    },
    {
      "key": "category-14",
      "name": "📁 • 𝗥𝗘𝗚𝗜𝗦𝗧𝗥𝗢𝗦",
      "channels": [
        {
          "key": "channel-14-1",
          "name": "「🎫」ʟᴏɢꜱ-ᴛɪᴄᴋᴇᴛꜱ",
          "type": 0,
          "position": 0
        },
        {
          "key": "channel-14-2",
          "name": "「🛡️」ʟᴏɢꜱ-ᴍᴏᴅᴇʀᴀᴄᴀᴏ",
          "type": 0,
          "position": 1
        },
        {
          "key": "channel-14-3",
          "name": "「📜」ʟᴏɢꜱ-ꜱᴇʀᴠɪᴅᴏʀ",
          "type": 0,
          "position": 2
        }
      ],
      "position": 14,
      "access": "hidden",
      "staff": {
        "admin": "publish",
        "moderator": "read",
        "attendant": "hidden"
      }
    },
    {
      "key": "category-15",
      "name": "📡 • 𝗠𝗢𝗡𝗜𝗧𝗢𝗥𝗔𝗠𝗘𝗡𝗧𝗢",
      "channels": [
        {
          "key": "channel-15-1",
          "name": "「📈」ᴘʀᴏɢʀᴇꜱꜱᴏ-ᴅᴀꜱ-ᴄᴏɴᴛᴀꜱ",
          "type": 0,
          "position": 0
        }
      ],
      "position": 15,
      "access": "hidden",
      "staff": {
        "admin": "publish",
        "moderator": "hidden",
        "attendant": "read"
      }
    }
  ],
  "status": {
    "key": "status",
    "name": "「🟢」ꜱᴛᴀᴛᴜꜱ-ᴅᴀ-ʟᴏᴊᴀ",
    "type": 0,
    "position": 0
  },
  "guild": {
    "verification_level": 1,
    "explicit_content_filter": 2,
    "default_message_notifications": 1,
    "preferred_locale": "pt-BR"
  },
  "security": {
    "mentionLimit": 5,
    "keywords": [],
    "domains": []
  },
  "fidelity": [
    {
      "name": "🥉 Bronze I",
      "purchasesBRL": 25,
      "discountPercent": 2
    },
    {
      "name": "🥉 Bronze II",
      "purchasesBRL": 50,
      "discountPercent": 3
    },
    {
      "name": "🥉 Bronze III",
      "purchasesBRL": 75,
      "discountPercent": 4
    },
    {
      "name": "🥈 Prata I",
      "purchasesBRL": 100,
      "discountPercent": 5
    },
    {
      "name": "🥈 Prata II",
      "purchasesBRL": 125,
      "discountPercent": 6
    },
    {
      "name": "🥈 Prata III",
      "purchasesBRL": 150,
      "discountPercent": 7
    },
    {
      "name": "🥇 Ouro I",
      "purchasesBRL": 175,
      "discountPercent": 8
    },
    {
      "name": "🥇 Ouro II",
      "purchasesBRL": 200,
      "discountPercent": 9
    },
    {
      "name": "🥇 Ouro III",
      "purchasesBRL": 250,
      "discountPercent": 10
    },
    {
      "name": "💠 Platina I",
      "purchasesBRL": 350,
      "discountPercent": 11
    },
    {
      "name": "💠 Platina II",
      "purchasesBRL": 500,
      "discountPercent": 12
    },
    {
      "name": "💎 Diamante I",
      "purchasesBRL": 650,
      "discountPercent": 13
    },
    {
      "name": "💎 Diamante II",
      "purchasesBRL": 800,
      "discountPercent": 14
    },
    {
      "name": "👑 Cliente VIP",
      "purchasesBRL": 1000,
      "discountPercent": 15
    }
  ]
};
