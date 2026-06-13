// Custom entry point. Unistyles MUST be configured before any module that uses
// unistyles-wrapped components is evaluated — otherwise on web the babel-injected
// component wrappers run before unistyles core finishes initializing and crash
// with "Cannot read properties of undefined (reading 'createUnistylesElement')".
// Importing the config here, ahead of expo-router/entry, guarantees the order.
import './lib/unistyles';
import 'expo-router/entry';
