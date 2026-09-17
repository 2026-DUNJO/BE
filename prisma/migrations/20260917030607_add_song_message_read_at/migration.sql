-- AlterTable
ALTER TABLE `SongMessage` ADD COLUMN `readAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `SongMessage_chatRoomId_readAt_idx` ON `SongMessage`(`chatRoomId`, `readAt`);
