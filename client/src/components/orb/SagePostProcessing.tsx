import React, { useMemo } from 'react';
import * as THREE from 'three';
import {
  EffectComposer,
  Bloom,
  Vignette,
  DepthOfField,
  ChromaticAberration,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

interface SagePostProcessingProps {
  bloomIntensity?: number;
  bloomThreshold?: number;
  showBloom?: boolean;
  showDepthOfField?: boolean;
  isMobile?: boolean;
}

export const SagePostProcessing: React.FC<SagePostProcessingProps> = ({
  bloomIntensity = 1.2,
  bloomThreshold = 0.4,
  showBloom = true,
  showDepthOfField = false,
  isMobile = false,
}) => {
  const chromaticOffset = useMemo(() => new THREE.Vector2(0.0006, 0.0005), []);

  return (
    <EffectComposer multisampling={isMobile ? 0 : 4}>
      {/* Optional Depth of Field */}
      {!isMobile && showDepthOfField && (
        <DepthOfField
          focusDistance={0.08}
          focalLength={0.2}
          bokehScale={1.2}
          height={480}
        />
      )}

      {/* Bloom — slightly stronger threshold to catch the rings and core */}
      {showBloom && (
        <Bloom
          luminanceThreshold={bloomThreshold}
          luminanceSmoothing={0.8}
          intensity={bloomIntensity}
          mipmapBlur
        />
      )}

      {/* Prismatic Chromatic Aberration (desktop only) */}
      {!isMobile && (
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={chromaticOffset}
        />
      )}

      {/* Cinematic Vignette */}
      <Vignette eskil={false} offset={0.18} darkness={0.8} />
    </EffectComposer>
  );
};
