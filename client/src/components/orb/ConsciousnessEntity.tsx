import React from 'react';
import { Float, Sparkles } from '@react-three/drei';
import { ConsciousnessCore } from './ConsciousnessCore';
import { NeuralNetwork } from './NeuralNetwork';
import { ArcGimbals } from './ArcGimbals';
import { DataFragments } from './DataFragments';
import type { SageStatus } from './types';

interface ConsciousnessEntityProps {
  status: SageStatus;
  isHovered: boolean;
  onHoverChange: (hovered: boolean) => void;
  introProgress: number;
  coreIntensity?: number;
  customHaloColor?: string;
  customNetworkColor?: string;
  numLayers?: number;
  outerRadius?: number;
  rotationSpeed?: number;
  nodeSize?: number;
  lineBrightness?: number;
  freeNodeRatio?: number;
  isMobile?: boolean;
  // Diagnosis Layer Toggles
  showCoreSphere?: boolean;
  showRays?: boolean;
  showHalo?: boolean;
  showNodes?: boolean;
  showLines?: boolean;
  showFragments?: boolean;
  showGimbals?: boolean;
}

export const ConsciousnessEntity: React.FC<ConsciousnessEntityProps> = ({
  status,
  isHovered,
  onHoverChange,
  introProgress,
  coreIntensity,
  customHaloColor,
  customNetworkColor,
  numLayers,
  outerRadius,
  rotationSpeed,
  nodeSize,
  lineBrightness,
  freeNodeRatio,
  isMobile,
  showCoreSphere = true,
  showRays = true,
  showHalo = true,
  showNodes = true,
  showLines = true,
  showFragments = true,
  showGimbals = true,
}) => {
  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation();
        onHoverChange(true);
      }}
      onPointerOut={() => {
        onHoverChange(false);
      }}
    >
      {/* Floating weightless levitation */}
      <Float speed={1.5} rotationIntensity={0.12} floatIntensity={0.25}>
        {/* Central Heart of Light and Starburst Rays */}
        <ConsciousnessCore
          status={status}
          isHovered={isHovered}
          introProgress={introProgress}
          intensityMultiplier={coreIntensity}
          customHaloColor={customHaloColor}
          showCoreSphere={showCoreSphere}
          showRays={showRays}
          showHalo={showHalo}
        />

        {/* Geometric Neural Network with Luminous Nodes and Impulse Lines */}
        {(showNodes || showLines) && (
          <NeuralNetwork
            status={status}
            isHovered={isHovered}
            introProgress={introProgress}
            isMobile={isMobile}
            numLayers={numLayers}
            outerRadius={outerRadius}
            rotationSpeed={rotationSpeed}
            nodeSize={nodeSize}
            lineBrightness={showLines ? lineBrightness : 0}
            freeNodeRatio={freeNodeRatio}
            customNetworkColor={customNetworkColor}
          />
        )}

        {/* Orbital Luminous Rings and High-Tech Arcs (Armillary Sphere) */}
        {showGimbals && (
          <ArcGimbals
            status={status}
            isHovered={isHovered}
            introProgress={introProgress}
            customColor={customHaloColor}
          />
        )}

        {/* Floating Holographic Data Panels */}
        {showFragments && (
          <DataFragments
            status={status}
            introProgress={introProgress}
            isMobile={isMobile}
          />
        )}

        {/* Ambient Ethereal Sparkle Dust */}
        <Sparkles
          count={isMobile ? 25 : 60}
          scale={5.0}
          size={isMobile ? 1.2 : 1.8}
          speed={0.3}
          color="#93c5fd"
          opacity={0.45 * introProgress}
        />
      </Float>
    </group>
  );
};
