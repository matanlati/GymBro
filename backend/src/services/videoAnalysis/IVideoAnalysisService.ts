import { VideoFile, VideoAnalysisResult } from '../../types'

export abstract class IVideoAnalysisService {
  abstract analyze(videoFile: VideoFile): Promise<VideoAnalysisResult>
}
