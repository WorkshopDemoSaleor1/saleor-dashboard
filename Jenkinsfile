pipeline{
	agent any 
    triggers {
    pollSCM('* * * * *')
    }
	stages{
		stage('vcs'){
			steps{
				git branch: 'main',
                    url: 'https://github.com/WorkshopDemoSaleor1/saleor-dashboard.git'				
				}			
			}
		
		stage('docker image build'){
			steps{
			    sh 'docker image build -t sashidhar33/saleor-dashboard1:Dev-22052332 .'		
			}
		}

        stage('docker image push to registry'){
            steps{
                sh 'docker image push sashidhar33/saleor-dashboard1:Dev-22052332'
            }
        }
	}

}