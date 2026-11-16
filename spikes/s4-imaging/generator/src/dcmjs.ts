// The slice of dcmjs (MIT) the generator uses, typed here: the package ships no declarations.
// @ts-expect-error -- untyped package; DcmjsApi below is the contract relied on.
import untyped from 'dcmjs';

interface DicomDictInstance {
  meta: Record<string, unknown>;
  dict: Record<string, unknown>;
  write(options?: { allowInvalidVRLength?: boolean }): ArrayBuffer;
}

interface DcmjsApi {
  data: {
    DicomDict: new (meta: Record<string, unknown>) => DicomDictInstance;
    DicomMessage: {
      readFile(buffer: ArrayBuffer, options?: { ignoreErrors?: boolean }): DicomDictInstance;
    };
    DicomMetaDictionary: {
      naturalizeDataset(dataset: Record<string, unknown>): Record<string, unknown>;
      denaturalizeDataset(dataset: Record<string, unknown>): Record<string, unknown>;
    };
  };
}

export const dcmjs = untyped as DcmjsApi;
