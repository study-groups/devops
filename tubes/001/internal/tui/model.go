package tui

// Model delegates to HybridModel as the working implementation
type Model = HybridModel

// initialModel creates the working model instance  
func initialModel(port string) Model {
	return *NewHybridModel(port)
}