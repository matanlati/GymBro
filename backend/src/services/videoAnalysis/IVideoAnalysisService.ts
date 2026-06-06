import { VideoFile } from '../../types'

export abstract class IVideoAnalysisService {
  abstract analyze(videoFile: VideoFile): Promise<unknown>
}
