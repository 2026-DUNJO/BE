-- CreateTable
CREATE TABLE `SongMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chatRoomId` INTEGER NOT NULL,
    `senderId` INTEGER NOT NULL,
    `spotifyTrackId` VARCHAR(191) NOT NULL,
    `trackTitle` VARCHAR(191) NOT NULL,
    `trackArtist` VARCHAR(191) NOT NULL,
    `albumImage` TEXT NULL,
    `spotifyUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SongMessage_chatRoomId_idx`(`chatRoomId`),
    INDEX `SongMessage_senderId_idx`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SongMessage` ADD CONSTRAINT `SongMessage_chatRoomId_fkey` FOREIGN KEY (`chatRoomId`) REFERENCES `ChatRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SongMessage` ADD CONSTRAINT `SongMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
