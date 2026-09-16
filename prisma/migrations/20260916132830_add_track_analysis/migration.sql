-- CreateTable
CREATE TABLE `TrackAnalysis` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `spotifyTrackId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `artist` VARCHAR(191) NOT NULL,
    `albumImage` TEXT NULL,
    `energy` INTEGER NOT NULL,
    `dreaminess` INTEGER NOT NULL,
    `confidence` INTEGER NOT NULL,
    `darkness` INTEGER NOT NULL,
    `danceability` INTEGER NOT NULL,
    `moodTags` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TrackAnalysis_spotifyTrackId_key`(`spotifyTrackId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
