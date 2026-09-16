import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateInvitationDto {
  @IsInt()
  receiverId: number;

  @IsString()
  @IsNotEmpty()
  spotifyTrackId: string;

  @IsString()
  @IsNotEmpty()
  trackTitle: string;

  @IsString()
  @IsNotEmpty()
  trackArtist: string;

  @IsOptional()
  @IsString()
  albumImage?: string;

  @IsOptional()
  @IsString()
  spotifyUrl?: string;
}